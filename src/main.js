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
        dry_run: false,
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

    var thresholdDate = new Date(new Date() - 86400000 * 7);

    return Q(true)
        .then(function () {
            var myContext = ispyContext.using("threshold_date", thresholdDate.getTime() + "");
            for (var c in config) {
                myContext = myContext.using(c, config[c]+"");
            }
            config.threshold_date = thresholdDate;

            return Q.npost(ispyContext, 'ispy', ['s3uploadcleaner.starting'])
                .then(function () {
                    return Q.npost(myContext, 'ispy', ['s3uploadcleaner.config']);
                });
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
