var Q = require('q');
var fs = require('fs');
var merge = require('merge');

var Executor = require('./executor');

var executor = new Executor(10);

var doCollectFromAws = function(nextJob, deferred, client, method, args, paginationHelper) {
    if (!args) args = {};
    // console.log("collectFromAws", client.serviceIdentifier, method, args);

    var cb = function (err, data) {
        if (err === null) {
            if (paginationHelper) {
                var nextArgs = paginationHelper.nextArgs(args, data);
                if (nextArgs) {
                    var promiseOfNextData = (exports.collectFromAws)(client, method, nextArgs, paginationHelper);
                    var promiseOfJoinedData = Q.all([ Q(data), promiseOfNextData ])
                        .spread(paginationHelper.promiseOfJoinedData);
                    deferred.resolve(promiseOfJoinedData);
                }
            }

            // Resolving a deferred twice (see above) is OK.  First wins.
            deferred.resolve(data);
        } else {
            if (err.code === 'Throttling') {
                var delay = exports.getDelay();
                console.log("Will try again in", delay, "ms");
                setTimeout(function () {
                    client[method].apply(client, [args, cb]);
                }, delay);
            } else {
                console.log("Got an error from", method, args, err);
                deferred.reject(err);
            }
        }
        nextJob();
    };

    client[method].apply(client, [args, cb]);
};

// How long to wait on Throttling errors.  Used for testing.
exports.getDelay = function () {
    return 1000 + Math.random() * 5000;
};

exports.collectFromAws = function (client, method, args, paginationHelper) {
    var deferred = Q.defer();
    executor.submit(doCollectFromAws, deferred, client, method, args, paginationHelper);
    return deferred.promise;
};

exports.paginationHelper = function (responseTokenField, requestTokenField, responseListField) {
    return {
        nextArgs: function (args, data) {
            if (!data[responseTokenField]) return;
            var toMerge = {};
            toMerge[requestTokenField] = data[responseTokenField];
            return merge({}, args, toMerge);
        },
        promiseOfJoinedData: function (data1, data2) {
            if (!data1[responseListField] || !data2[responseListField]) {
                console.log("data1", data1);
                console.log("data2", data2);
                throw new Error("Can't join pages - at least one of them is missing " + responseListField);
            }
            var toMerge = {};
            toMerge[responseListField] = data1[responseListField].concat(data2[responseListField]);
            return merge({}, data2, toMerge);
        }
    };
};

exports.setConcurrency = function (n) {
    executor = new Executor(n);
};

