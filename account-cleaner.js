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

var awsDataUtils = require('./aws-data-utils');
var bucketCleaner = require('./bucket-cleaner');

var AccountCleaner = function (s3Client, config, ispyContext) {

    var cleanBucket = function (bucketName) {
        console.log("Clean bucket", bucketName);

        return awsDataUtils.collectFromAws(s3Client, "getBucketLocation", { Bucket: bucketName })
            .then(function (r) {
                console.log("Bucket", bucketName, "is in location", r.LocationConstraint);
                if (!r.LocationConstraint.match(config.bucket_location_match)) return;

                var region = r.LocationConstraint;
                if (region === 'EU') region = 'eu-west-1';
                console.log("Bucket", bucketName, "is in region", region);

                // FIXME should copy all other options from s3Client and ONLY
                // change the region / endpoint.
                var regionClient = new AWS.S3({ region: region });
                return new bucketCleaner.BucketCleaner(regionClient, bucketName, config, ispyContext).run();
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

module.exports = {
    AccountCleaner: AccountCleaner,
};
