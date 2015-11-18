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
