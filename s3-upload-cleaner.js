var Q = require('q');
var AWS = require('aws-sdk');
var uuid = require('node-uuid');

var MessageSink = require('message-sink');
var IspyContext = require('ispy-context');

var accountCleaner = require('./account-cleaner');

var config = require('./configuration.json').reduce(function (data, entry) {
    data[entry.key] = entry.value;
    return data;
}, {});

Q.longStackSupport = true;

var handler = function (event, context) {
    console.log("event =", event);

    var ispyContext = new IspyContext(uuid.v4(), new MessageSink(config.ispy_topic));
    ispyContext.putLambdaContext(context);

    var s3Client = new AWS.S3({ region: 'eu-west-1' });

    var myAccountCleaner = new accountCleaner.AccountCleaner(s3Client, config, ispyContext);

    // FIXME, set var thresholdDate
    var thresholdDate = null;

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
        .then(myAccountCleaner.run)
        .then(function () {
            return Q.npost(ispyContext, 'ispy', ['s3uploadcleaner.complete']);
        })
        .then(context.succeed)
        .done();
};

module.exports = {
    handler: handler
};
