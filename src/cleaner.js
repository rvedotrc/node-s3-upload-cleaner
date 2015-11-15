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

                console.log("listParts", bucketName, upload.Key, upload.UploadId, params.PartNumberMarker, "yielded", partCount, totalSize);

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
        console.log("handleUpload", bucketName, upload);
        // FIXME apply key check

        // ESSENTIAL: check initiated date; return if too young
        var thresholdDate = new Date(new Date() - 86400000*1); // 24 hours ago
        if (upload.Initiated > thresholdDate) {
            console.log("Ignoring fresh upload", bucketName, upload);
            return;
        }

        return handleParts(upload, {})
            .then(function (answer) {
                console.log("upload", upload.UploadId, "enumerated as", answer);
                // TODO "abortMultipartUpload", { Bucket: x, Key: y, UploadId: z }
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
                // FIXME apply location check
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
                        // FIXME apply bucket name check
                        return cleanBucket(d.Name);
                    })
                );
            });
    };

};

module.exports = Cleaner;
