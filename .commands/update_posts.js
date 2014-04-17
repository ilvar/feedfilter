var DDPClient = require("ddp");
var rssparser = require("rssparser");
var natural = require("natural");
var _ = require("lodash");
var request = require('request');
var encoding = require('encoding');

var ddpclient = new DDPClient({
    // host: "localhost",
    // port: 3000,
    host: "feedfilter.meteor.com",
    port: 80,

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
        var processed_feeds = 0;
        var all_feeds = 0;

        console.log('Got', _.keys(feeds));

        _.each(feeds, function(f, fid) {
            all_feeds += 1;

            if (!f.url) {
                return;
            }

            console.log('Processing', f.url);

            var restoredClassifier = f.classifier && natural.BayesClassifier.restore(JSON.parse(f.classifier))
            var allow_classifying = restoredClassifier && restoredClassifier.classifier.totalExamples > 10

            var enc = 'utf-8';
            request({uri: f.url, encoding: 'binary'}, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    var top = body.substr(0, 100);
                    var re = /encoding=['"](.+)['"]/gi;
                    var match = re.exec(top);
                    if (match.length) {
                        enc = match[1];
                    }
                    enc = enc.replace('windows-', 'cp');

                    body = new Buffer(body, 'binary');
                    body = encoding.convert(body, 'utf8', enc).toString();

                    rssparser.parseString(body, {}, function(err, feed_data) {
                        _.each(feed_data.items, function(post) {
                            var post_url = post.url || post.guid.link;
                            var cat = allow_classifying && restoredClassifier.classify(post.title + ' ' + post.summary);

                            var update_data = {
                                url: post_url,
                                feedId: fid,
                                userId: f.userId,
                                title: post.title,
                                summary: post.summary,
                                category: cat || '2 neutral',
                                published_at: post.published_at
                            }

                            ddpclient.call('push_post', [update_data], function(err, result) {
                                console.log('Pushed post', post_url, cat);
                            });
                        });

                        processed_feeds += 1;
                        if (processed_feeds == all_feeds) {
                            console.log('Finished', processed_feeds);
                            process.exit()
                        }
                    });

                    console.log('Processed feed', f.url);
                }
            })
        });
    });
});

