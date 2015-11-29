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

var merge = require('merge');

var consoleSink = {
    write: function (e, cb) {
        console.log("ispy", JSON.stringify(e));
        process.nextTick(cb);
    },
};

var IspyContextLite = function (messageSink) {
    this.messageSink = messageSink || consoleSink;
    this.data = {};
};

IspyContextLite.prototype.ispy = function (event_name, cb) {
    var e = merge(true, this.data, { event_name: event_name });
    this.messageSink.write(e, cb);
};

IspyContextLite.prototype.using = function (k, v) {
    var other = new IspyContextLite(this.messageSink);
    other.data = merge(true, this.data);

    if (typeof(k) === 'string') {
        other.data[k] = v;
    } else {
        merge(other.data, k);
    }

    return other;
};

module.exports = IspyContextLite;