var DDPClient = require("ddp");
var rssparser = require("rssparser");
var natural = require("natural");
var _ = require("lodash");
var request = require('request');
var encoding = require('encoding');

var ddpclient = new DDPClient({
    host: "localhost",
    port: 3000,

    auto_reconnect: true,
    auto_reconnect_timer: 500,
    use_ejson: true,  // default is false
    use_ssl: false, //connect to SSL server,
    use_ssl_strict: true, //Set to false if you have root ca trouble.
    maintain_collections: true //Set to false to maintain your own collections.
});

ddpclient.connect(function(error) {
    if (error) {
        console.log('DDP connection error!');
        return;
    }

    console.log('connected!');

    ddpclient.call('reset_classifiers', [], function(err, result) {
        console.log('Finished');
        process.exit()
    });
});

