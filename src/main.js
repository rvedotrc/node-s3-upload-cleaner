var Q = require('q');
var AWS = require('aws-sdk');
var uuid = require('node-uuid');

var IspyContext = require('ispy-context');

var Cleaner = require('./cleaner');

Q.longStackSupport = true;

var handler = function () {
    var config = {
        bucket_location_match: ".*",
        bucket_name_match: ".*",
        key_match: ".*",
        dry_run: true,
    };

    var messageSink = {
        write: function (message, cb) {
            console.log("ispy", message);
            cb();
        },
    };

    var ispyContext = new IspyContext(uuid.v4(), messageSink);

    var s3Client = new AWS.S3({ region: 'eu-west-1' });

    var cleaner = new Cleaner(s3Client, config, ispyContext);

    return Q(true)
        .then(function () {
            return Q.npost(ispyContext, 'ispy', ['s3uploadcleaner.starting']);
        })
        .then(cleaner.run)
        .then(function () {
            return Q.npost(ispyContext, 'ispy', ['s3uploadcleaner.complete']);
        })
//         .catch(function (err) {
//             return Q.npost(ispyContext.using("error", err.toString()), 'ispy', ['s3uploadcleaner.failed']);
//         })
        .done();
};

handler();
