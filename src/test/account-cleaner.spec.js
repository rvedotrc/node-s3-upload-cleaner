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

    // lists buckets
    // applies bucket_name_match
    // calls BucketCleaner with client in correct region
    // knows that EU == eu-west-1

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

    it("processes each bucket", function (mochaDone) {
        var buckets = [
          { Name: 'one' },
          { Name: 'two' },
        ];

        var s3Client = {
            listBuckets: function (params, cb) {
                cb(null, { Buckets: buckets });
            },
            getBucketLocation: function (params, cb) {
                cb(null, { LocationConstraint: 'region-for-' + params.Bucket });
            },
        };

        var config = {id:'config'};
        var ispyContext = {id: 'ispyContext'};

        sandbox.stub(AWS, 'S3', function (params) {
            return {
                'an s3 client': true,
                params: params,
            };
        });

        var calledForOne = false;
        var calledForTwo = false;

        sandbox.stub(bucketCleaner, 'BucketCleaner', function (s3Client, bucketName, bc_config, bc_ispyContext) {
            if (bucketName === 'one') {
                calledForOne = true;
                assert.equal(s3Client.params.region, 'region-for-one');
            }
            if (bucketName === 'two') {
                calledForTwo = true;
                assert.equal(s3Client.params.region, 'region-for-two');
            }

            assert.equal(bc_config, config);
            assert.equal(bc_ispyContext, ispyContext);
            console.log("new BucketCleaner called with", arguments);
            return {
                run: function () {},
            };
        });

        var underTest = new accountCleaner.AccountCleaner(s3Client, config, ispyContext);
        underTest.run().then(function () {
            assert(calledForOne);
            assert(calledForTwo);
            mochaDone();
        }).done();
    });

});
