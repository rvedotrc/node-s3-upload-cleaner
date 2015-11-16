var Q = require('q');
var AWS = require('aws-sdk');
var merge = require('merge');

var awsDataUtils = require('./aws-data-utils');

var SingleBucketCleaner = function (s3Client, bucketName, config, ispyContext) {

    var handleParts = function (upload, params) {
        return awsDataUtils.collectFromAws(s3Client, "listParts", merge(true, params, { Bucket: bucketName, Key: upload.Key, UploadId: upload.UploadId }))
            .then(function (r) {
                var partCount = r.Parts.length;
                var totalSize = r.Parts.reduce(function (prev, next) {
                    return prev + next.Size;
                }, 0);

                // console.log("listParts", bucketName, upload.Key, upload.UploadId, params.PartNumberMarker, "yielded", partCount, totalSize);

                if (r.IsTruncated) {
                    return handleParts(upload, { PartNumberMarker: r.NextPartNumberMarker })
                        .then(function (theirData) {
                            return {
                                partCount: partCount + theirData.partCount,
                                totalSize: totalSize + theirData.totalSize,
                            };
                        });
                } else {
                    return { partCount: partCount, totalSize: totalSize };
                }
            });
    };

    var handleUpload = function (upload) {
        // console.log("handleUpload", bucketName, upload);
        if (!upload.Key.match(config.key_match)) return;

        // ESSENTIAL: check initiated date; return if too young
        if (!config.threshold_date) throw "no threshold_date";
        if (upload.Initiated > config.threshold_date) {
            console.log("Ignoring fresh upload", bucketName, upload.UploadId, "from", upload.Initiated);
            return;
        }

        return handleParts(upload, {})
            .then(function (answer) {
                var toLog = {
                    bucket_name: bucketName,
                    upload_key: upload.Key,
                    upload_initiated: upload.Initiated.getTime()+"",
                    upload_storage_class: upload.StorageClass,
                    upload_initiator_id: upload.Initiator.ID,
                    upload_initiator_display: upload.Initiator.DisplayName,
                    // not logging: Owner; UploadId
                    part_count: answer.partCount+"",
                    total_size: answer.totalSize+"",
                };
                var myContext = ispyContext.using(toLog);

                if (config.dry_run !== false) {
                    return Q.npost(myContext.using("dry_run", "true"), 'ispy', ['s3uploadcleaner.clean']);
                }

                return awsDataUtils.collectFromAws(s3Client, "abortMultipartUpload", { Bucket: bucketName, Key: upload.Key, UploadId: upload.UploadId })
                    .then(function () {
                        toLog.dry_run = false;
                        return Q.npost(myContext.using("dry_run", "false"), 'ispy', ['s3uploadcleaner.clean']);
                    });
            });
    };

    var handleList = function (params) {
        return awsDataUtils.collectFromAws(s3Client, "listMultipartUploads", merge(true, params, { Bucket: bucketName }))
            .then(function (r) {
                // console.log("multipart uploads for", bucketName, "=", r);

                var handleUploads = Q.all(r.Uploads.map(handleUpload));

                var nextPage = Q(true);
                if (r.IsTruncated) {
                    nextPage = handleList({ KeyMarker: r.NextKeyMarker, UploadIdMarker: r.NextUploadIdMarker });
                }

                return Q.all([ handleUploads, nextPage ]);
            });
    };

    this.run = function () {
        console.log("Running cleaner for bucket", bucketName);
        return handleList({});
    };

};

var Cleaner = function (s3Client, config, ispyContext) {

    var cleanBucket = function (bucketName) {
        console.log("Clean bucket", bucketName);

        return awsDataUtils.collectFromAws(s3Client, "getBucketLocation", { Bucket: bucketName })
            .then(function (r) {
                console.log("Bucket", bucketName, "is in location", r.LocationConstraint);
                if (!r.LocationConstraint.match(config.bucket_location_match)) return;

                var region = r.LocationConstraint;
                if (region === 'EU') region = 'eu-west-1';
                console.log("Bucket", bucketName, "is in region", region);

                var regionClient = new AWS.S3({ region: region });
                return new SingleBucketCleaner(regionClient, bucketName, config, ispyContext).run();
            });
    };

    this.run = function () {
        console.log("Running cleaner");

        return awsDataUtils.collectFromAws(s3Client, "listBuckets", {})
            .then(function (r) {
                return Q.all(
                    r.Buckets.map(function (d) {
                        if (!d.Name.match(config.bucket_name_match)) return;
                        return cleanBucket(d.Name);
                    })
                );
            });
    };

};

module.exports = Cleaner;
