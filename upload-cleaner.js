/*
Copyright 2015 Rachel Evans

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

var Q = require('q');
var AWS = require('aws-sdk');
var merge = require('merge');

var awsDataUtils = require('./aws-data-utils');

var UploadCleaner = function (s3Client, bucketName, upload, config, ispyContext) {

    var handleParts = function (params) {
        return awsDataUtils.collectFromAws(s3Client, "listParts", merge(true, params, { Bucket: bucketName, Key: upload.Key, UploadId: upload.UploadId }))
            .then(function (r) {
                var partCount = r.Parts.length;
                var totalSize = r.Parts.reduce(function (prev, next) {
                    return prev + next.Size;
                }, 0);

                // console.log("listParts", bucketName, upload.Key, upload.UploadId, params.PartNumberMarker, "yielded", partCount, totalSize);

                if (r.IsTruncated) {
                    return handleParts({ PartNumberMarker: r.NextPartNumberMarker })
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

    this.run = function () {
        return handleParts({})
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
            }).catch(function (err) {
                if (err.code === 'NoSuchUpload') {
                    console.log("Ignoring error", err, "for upload", bucketName, upload.Key, upload.UploadId);
                    return;
                }
                throw err;
            });
    };

};

module.exports = {
    UploadCleaner: UploadCleaner,
};
