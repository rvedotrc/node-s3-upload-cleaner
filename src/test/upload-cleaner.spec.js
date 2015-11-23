var assert = require("assert");
var sinon = require("sinon");
require("should");

var uploadCleaner = require("../upload-cleaner");

var IspyContext = require("ispy-context");
var Q = require("q");
Q.longStackSupport = true;

describe("UploadCleaner", function () {

    var sandbox;

    beforeEach(function () {
        sandbox = sinon.sandbox.create();
    });

    afterEach(function () {
        sandbox.restore();
    });

    var runUpload = function (dryRun) {
        var bucketName = 'some-bucket';

        var upload = {
            UploadId: 'some-upload-id',
            Key: 'some-key',
            Initiated: new Date(123456789),
            StorageClass: 'SOME-CLASS',
            Owner: { DisplayName: 'the-owner', ID: 'arn:the-owner' },
            Initiator: { DisplayName: 'the-initiator', ID: 'arn:the-initiator' },
        };

        var config = {
            dry_run: dryRun,
        };

        var aborted = false;
        var s3Client = {
            listParts: function (params, cb) {
                console.log("listParts called with", params);
                cb(null, { IsTruncated: false, Parts: [] });
            },
            abortMultipartUpload: function (params, cb) {
                console.log("abortMultipartUpload called with", params);
                assert.equal(params.Bucket, bucketName);
                assert.equal(params.Key, upload.Key);
                assert.equal(params.UploadId, upload.UploadId);
                aborted = true;
                cb(null);
            },
        };

        var receivedEvents = [];
        var messageSink = {
            write: function (m, cb) {
                var events = JSON.parse(m);
                receivedEvents = receivedEvents.concat(events);
                cb(null);
            },
        };
        var ispyContext = new IspyContext('some-activity-id', messageSink);

        var underTest = new uploadCleaner.UploadCleaner(s3Client, bucketName, upload, config, ispyContext);
        return underTest.run()
            .then(function () {
                if (dryRun) {
                    assert(!aborted, "Upload should not have been aborted");
                } else {
                    assert(aborted, "Upload should have been aborted");
                }

                receivedEvents.map(function (e) { delete e.event_timestamp; });
                assert.deepEqual(receivedEvents, [{
                    event_name: 's3uploadcleaner.clean',
                    activity_id: 'some-activity-id',
                    bucket_name: 'some-bucket',
                    upload_key: 'some-key',
                    upload_initiated: '123456789',
                    upload_storage_class: 'SOME-CLASS',
                    upload_initiator_id: 'arn:the-initiator',
                    upload_initiator_display: 'the-initiator',
                    part_count: '0',
                    total_size: '0',
                    dry_run: dryRun.toString(),
                }]);
            });
    };

    it("aborts an upload", function (mochaDone) {
        runUpload(false)
            .then(function () { mochaDone(); })
            .done();
    });

    it("respects dry_run", function (mochaDone) {
        runUpload(true)
            .then(function () { mochaDone(); })
            .done();
    });

    it("sums parts", function (mochaDone) {
        mochaDone();
    });

    it("paginates parts", function (mochaDone) {
        mochaDone();
    });

    it("swallows NoSuchUpload errors", function (mochaDone) {
        mochaDone();
    });

});
