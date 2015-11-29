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

var Q = require("q");
var assert = require("assert");

var IspyContextLite = require('../s3-upload-cleaner').IspyContextLite;

describe("IspyContextLite", function () {

    var events;
    var mySink;

    beforeEach(function () {
        events = [];
        mySink = {
            write: function (h, cb) {
                events.push(h);
                process.nextTick(cb);
            },
        };
    });

    // This is deliberately not full test coverage; this is temporary until
    // the real IspyContext code is open sourced.

    it("Sends to the custom sink", function (mochaDone) {
        var i = new IspyContextLite(mySink);
        Q.npost(i, "ispy", [ "some-event" ])
            .then(function () {
                assert.deepEqual(events, [ { event_name: "some-event" } ]);
                mochaDone();
            })
            .done();
    });

    it("Can add key/value", function (mochaDone) {
        var i = new IspyContextLite(mySink).using("a_key", "a-value");
        Q.npost(i, "ispy", [ "some-event" ])
            .then(function () {
                assert.deepEqual(events, [ { event_name: "some-event", a_key: "a-value" } ]);
                mochaDone();
            })
            .done();
    });

    it("Can add a map", function (mochaDone) {
        var i = new IspyContextLite(mySink).using({ a: "1", b: "2" });
        Q.npost(i, "ispy", [ "some-event" ])
            .then(function () {
                assert.deepEqual(events, [ { event_name: "some-event", a: "1", b: "2" } ]);
                mochaDone();
            })
            .done();
    });

});
