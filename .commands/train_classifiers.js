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

    ddpclient.subscribe('feeds', [], function() {
        var feeds = ddpclient.collections.feeds || [];
        var processed_cnt = 0;
        var all_cnt = 0;

        _.each(feeds, function(f, fid) {
            if (!f.url) {
                return;
            }
            all_cnt += 1;
            ddpclient.subscribe('posts', [{feedId: fid, read: true}], function() {
                var posts = ddpclient.collections.posts || [];
                classifier = new natural.BayesClassifier()

                _.each(posts, function(p, pid) {
                    classifier.addDocument(p.title + ' ' + p.summary, p.category || '2 neutral');
                });

                classifier.train()

                ddpclient.call('save_classifier', [fid, JSON.stringify(classifier)], function(err, result) {
                    processed_cnt += 1;
                    if (processed_cnt == all_cnt) {
                        console.log('Finished');
                        process.exit()
                    }
                });
            });

            console.log('Processed', f.url);
        });

    });
});

