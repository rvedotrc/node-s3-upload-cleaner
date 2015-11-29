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
