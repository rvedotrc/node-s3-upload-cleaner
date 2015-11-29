var Q = require('q');
var AWS = require('aws-sdk');
var merge = require('merge');

var awsDataUtils = require('./aws-data-utils');
var uploadCleaner = require('./upload-cleaner');

var BucketCleaner = function (s3Client, bucketName, config, ispyContext) {

    var handleUpload = function (upload) {
        // console.log("handleUpload", bucketName, upload);
        if (!upload.Key.match(config.key_match)) return;

        // ESSENTIAL: check initiated date; return if too young
        if (!config.threshold_date) throw "no threshold_date";
        if (upload.Initiated > config.threshold_date) {
            console.log("Ignoring fresh upload", bucketName, upload.UploadId, "from", upload.Initiated);
            return;
        }

        return new uploadCleaner.UploadCleaner(s3Client, bucketName, upload, config, ispyContext).run();
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

module.exports = {
    BucketCleaner: BucketCleaner,
};
