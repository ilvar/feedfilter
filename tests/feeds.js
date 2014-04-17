var assert = require('assert');

// http://habrahabr.ru/post/213171/

suite('Feeds', function () {
    test('in the server', function (done, server) {
        server.eval(function () {
            Feeds.insert({url: 'http://bash.im/rss/'});
            var feeds = Feeds.find().fetch();
            emit('feeds', feeds);
        });

        server.once('feeds', function (feeds) {
            assert.equal(feeds.length, 1);
            done();
        });
    });

    test('using both client and the server', function (done, server, client) {
        server.eval(function () {
            Feeds.find().observe({
                added: addedNewFeed
            });

            function addedNewFeed(feed) {
                emit('feed', feed);
            }
        }).once('feed', function (feed) {
            assert.equal(feed.url, 'http://bash.im/rss/');
            done();
        });

        client.eval(function() {
            Feeds.insert({url: 'http://bash.im/rss/'});
        });
    });

    test('using two clients', function (done, server, c1, c2) {
        c1.eval(function () {
            Feeds.find().observe({
                added: addedNewFeed
            });

            function addedNewFeed(feed) {
                emit('feed', feed);
            }

            emit('done');
        }).once('feed',function (feed) {
            assert.equal(feed.url, 'http://bash.im/rss/');
            done();
        }).once('done', function () {
            c2.eval(insertPost);
        });

        function insertPost() {
            Feeds.insert({url: 'http://bash.im/rss/'});
        }
    });
});