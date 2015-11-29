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

var s3UploadCleaner = require('s3-upload-cleaner');
var AWS = require('aws-sdk');

var config = {
        bucket_location_match: ".*",
        bucket_name_match: ".*",
        key_match: ".*",
        dry_run: false,
	threshold_date: new Date(new Date() - 1000 * 60 * 60 * 24 * 7),
};

var s3Client = new AWS.S3({ region: 'eu-west-1' });
var ispyContext = new s3UploadCleaner.IspyContextLite();
var cleaner = new s3UploadCleaner.AccountCleaner(s3Client, config, ispyContext);

cleaner.run().done();
