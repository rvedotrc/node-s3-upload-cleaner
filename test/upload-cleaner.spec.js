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

var assert = require("assert");
var sinon = require("sinon");
require("should");

var s3UploadCleaner = require("../s3-upload-cleaner");

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
            write: function (event, cb) {
                console.log("Got ispy", event);
                receivedEvents.push(event);
                cb(null);
            },
        };
        var ispyContext = new s3UploadCleaner.IspyContextLite(messageSink);

        var underTest = new s3UploadCleaner.UploadCleaner(s3Client, bucketName, upload, config, ispyContext);
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
