var assert = require("assert");
var sinon = require("sinon");
require("should");

var AWS = require("aws-sdk");

var accountCleaner = require("../account-cleaner");
var bucketCleaner = require("../bucket-cleaner");

describe("AccountCleaner", function () {

    var sandbox;

    beforeEach(function () {
        sandbox = sinon.sandbox.create();
    });

    afterEach(function () {
        sandbox.restore();
    });

    it("processes zero buckets", function (mochaDone) {
        var s3Client = {
            listBuckets: function (params, cb) {
                             cb(null, { Buckets: [] });
                         },
        };

        var config = {};
        var ispyContext = {};

        var underTest = new accountCleaner.AccountCleaner(s3Client, config, ispyContext);
        underTest.run().then(function () {
            mochaDone();
        }).done();
    });

    var makeUnderTest = function (bucketRegions, buckets, config, ispyContext, calledBuckets, runner) {
        var s3Client = {
            listBuckets: function (params, cb) {
                assert.deepEqual(params, {});
                cb(null, { Buckets: buckets });
            },
            getBucketLocation: function (params, cb) {
                cb(null, { LocationConstraint: bucketRegions[params.Bucket] });
            },
        };

        sandbox.stub(AWS, 'S3', function (params) {
            return {
                'an s3 client': true,
                params: params,
            };
        });

        sandbox.stub(bucketCleaner, 'BucketCleaner', function (s3Client, bucketName, bc_config, bc_ispyContext) {
            if (!bucketRegions[bucketName]) {
                throw 'Called for unexpected bucket ' + bucketName;
            }

            calledBuckets[bucketName] = s3Client.params.region;
            assert.equal(bc_config, config);
            assert.equal(bc_ispyContext, ispyContext);
            console.log("new BucketCleaner called with", arguments);

            return {
                bucket: bucketName,
                run: runner || (function () {}),
            };
        });

        return new accountCleaner.AccountCleaner(s3Client, config, ispyContext);
    };

    it("processes each bucket", function (mochaDone) {
        var bucketRegions = {
            one: 'region-for-one',
            two: 'region-for-two',
        };

        var buckets = [
          { Name: 'one' },
          { Name: 'two' },
        ];

        var config = {id:'config'};
        var ispyContext = {id: 'ispyContext'};
        var calledBuckets = {};

        var underTest = makeUnderTest(bucketRegions, buckets, config, ispyContext, calledBuckets);

        underTest.run().then(function () {
            assert.deepEqual(calledBuckets, bucketRegions);
            mochaDone();
        }).done();
    });

    it("respects bucket_name_match", function (mochaDone) {
        var bucketRegions = {
            one: 'region-for-one',
            two: 'region-for-two',
            three: 'region-for-three',
        };

        var buckets = [
          { Name: 'one' },
          { Name: 'two' },
          { Name: 'three' },
        ];

        var config = { bucket_name_match: '^t' };
        var ispyContext = {id: 'ispyContext'};
        var calledBuckets = {};

        var underTest = makeUnderTest(bucketRegions, buckets, config, ispyContext, calledBuckets);

        underTest.run().then(function () {
            assert.deepEqual(calledBuckets, {
                two: 'region-for-two',
                three: 'region-for-three',
            });
            mochaDone();
        }).done();
    });

    it("respects bucket_location_match", function (mochaDone) {
        var bucketRegions = {
            one: 'region-for-one',
            two: 'region-for-two',
            three: 'region-for-three',
        };

        var buckets = [
          { Name: 'one' },
          { Name: 'two' },
          { Name: 'three' },
        ];

        var config = { bucket_location_match: 'for-t' };
        var ispyContext = {id: 'ispyContext'};
        var calledBuckets = {};

        var underTest = makeUnderTest(bucketRegions, buckets, config, ispyContext, calledBuckets);

        underTest.run().then(function () {
            assert.deepEqual(calledBuckets, {
                two: 'region-for-two',
                three: 'region-for-three',
            });
            mochaDone();
        }).done();
    });

    it("knows that EU == eu-west-1", function (mochaDone) {
        var bucketRegions = {
            one: 'eu-west-1',
            two: 'eu-west-2',
            three: 'EU',
        };

        var buckets = [
          { Name: 'one' },
          { Name: 'two' },
          { Name: 'three' },
        ];

        var config = {};
        var ispyContext = {id: 'ispyContext'};
        var calledBuckets = {};

        var underTest = makeUnderTest(bucketRegions, buckets, config, ispyContext, calledBuckets);

        underTest.run().then(function () {
            assert.deepEqual(calledBuckets, {
                one: 'eu-west-1',
                two: 'eu-west-2',
                three: 'eu-west-1',
            });
            mochaDone();
        }).done();
    });

    it("fails if any bucket fails", function (mochaDone) {
        var bucketRegions = {
            one: 'r',
            two: 'r',
            three: 'r',
        };

        var buckets = [
          { Name: 'one' },
          { Name: 'two' },
          { Name: 'three' },
        ];

        var config = {};
        var ispyContext = {id: 'ispyContext'};
        var calledBuckets = {};

        var runner = function () {
            if (this.bucket === 'two') throw 'bucket two fails';
        };

        var underTest = makeUnderTest(bucketRegions, buckets, config, ispyContext, calledBuckets, runner);

        underTest.run().then(
            function () {
                throw 'Bucket failure should have caused promise failure';
            }, function () {
                mochaDone();
            }).done();
    });

    // TODO it preserves original s3Client options except region/endpoint

});
