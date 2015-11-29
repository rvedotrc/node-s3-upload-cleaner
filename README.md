s3-upload-cleaner - abort stale S3 multipart uploads
====================================================

Synopsis
--------

<pre>
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
</pre>

The problem
-----------

To upload data to AWS S3, several methods are possible, one of which is
Multipart Uploads: https://docs.aws.amazon.com/AmazonS3/latest/dev/mpuoverview.html

To perform a Multipart Upload, the client _initiates_ the upload, then adds
one or more _parts_, then _completes_ the upload.  Or, an initiated upload can
be _aborted_.  Completing the upload takes the parts and uses them to create
the desired object in S3; aborting the upload discards the parts.

The problem is that it's very easy to forget (e.g. due to a crash) to ever
complete or abort a multipart upload; and there is _no timeout_.  That is,
incomplete multipart uploads remain incomplete forever, until _complete_ or
_abort_ is called.

Storage for data uploaded to a not-yet-complete multipart upload _is_ billable.

The solution
------------

The S3 Upload Cleaner finds incomplete multipart uploads in each of your S3
buckets, and aborts any which are "stale" - that is, those which were started
a long time ago.  (In example/minimal.js, the threshold for this is 1 week).

Therefore, periodically running the S3 Upload Cleaner on your account can save
you money.

In general, any errors encountered will cause the cleaner to abort.  For
example, if an AWS permissions error is encountered, then some multipart
uploads might not be cleaned.

Configuration
-------------

The config object (see above) recognises a number of keys:

 * `bucket_name_match`: a regular expression string; buckets whose names don't
   match this will be ignored.
 
 * `bucket_location_match`: a regular expression string; buckets whose
   locations (aka region) don't match this will be ignored.

 * `key_match`: a regular expression string; multipart uploads going to keys
   that don't match this will be ignored.

 * `threshold_date`: a Date object; multipart uploads initiated after this
   date will be ignored.

 * `dry_run`: boolean; if true, then don't actually abort the uploads (but
   _do_ find the upload and emit the relevant iSpy events).

iSpy events
-----------

The cleaner emits "iSpy events" (an event is basically a String/String map)
for each multipart upload.  In example/minimal.js, these are logged to the
console in json form.  Supply your own "sink" to IspyContextLite to change
this behaviour; see ispy-context-lite.js.

IspyContextLite is a (hopefully temporary) placeholder for the full
IspyContext module, which should hopefully be open sourced soon.

Bugs
----

Unit testing is incomplete.

Proxy and other settings should be (but aren't) propagated from the initial S3
client, to the client created for each S3 location.

Author
------

Rachel Evans (http://rve.org.uk/)

