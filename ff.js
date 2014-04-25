Feeds = new Meteor.Collection("feeds");
Posts = new Meteor.Collection("posts");

if (Meteor.isClient) {
    Template.posts.posts = function() {
        return Posts.find({read: {$ne: true}}, {sort: {category: 1}, limit: 50})
    }

    Template.posts.feeds = function() {
        return Feeds.find()
    }

    Template.posts.panel_class = function () {
        if (this.category == '1 good') { return 'success'; }
        if (this.category == '3 bad') { return 'danger'; }
        return 'default';
    }

    Template.posts.feed_url = 'http://';

    Template.posts.helpers({
        feed_title: function() {
            return this.title || this.url;
        },
        current_feed: function () {
            return Session.get("current_feed");
        }
    });

    Template.posts.events({
        'click .post-good': function (e) {
            Posts.update(this._id, {$set: {read: true, category: '1 good'}});
        },
        'click .post-bad': function (e) {
            Posts.update(this._id, {$set: {read: true, category: '3 bad'}});
        },
        'change form.add_feed input': function (e) {
            Session.set('feed_url', e.target.value);
        },
        'change .edit-feed-window input.url': function (e) {
            var f = Session.get("current_feed");
            Feeds.update(f._id, {$set: {url: e.target.value}});
        },
        'change .edit-feed-window input.title': function (e) {
            var f = Session.get("current_feed");
            Feeds.update(f._id, {$set: {title: e.target.value}});
        },
        'change .edit-feed-window textarea.good-words': function (e) {
            var f = Session.get("current_feed");
            Feeds.update(f._id, {$set: {good_words: e.target.value}});
        },
        'change .edit-feed-window textarea.bad-words': function (e) {
            var f = Session.get("current_feed");
            Feeds.update(f._id, {$set: {bad_words: e.target.value}});
        },
        'click a.edit-feed': function() {
            Session.set("current_feed", this);
        },
        'click .edit-feed-window .ff-delete-feed': function() {
            var f = Session.get("current_feed");
            Meteor.call('remove_feed', f._id, function() {});
        },
        'click .edit-feed-window .ff-save-feed': function() {
            var f = Session.get("current_feed");
            Feeds.update(f._id, {$set: {url: f.url, good_words: f.good_words, bad_words: f.bad_words}});
        },
        'click form.add_feed button': function (e) {
            var url = Session.get('feed_url');
            var existing = Feeds.findOne({url: url});
            if (!existing) {
                var fid = Feeds.insert({
                    url: url,
                    userId: Meteor.userId()
                });
            }
        }
    });
}

if (Meteor.isServer) {
    var MyCron = new Cron(60000);

    Meteor.methods({
        reset_classifiers: function () {
            Posts.remove('*.category');
            Feeds.remove('*.classifier');
        },
        reset_feeds: function () {
            Posts.remove({});
            Feeds.remove({});
        },
        remove_feed: function(fid) {
            Posts.remove({feedId: fid});
            Feeds.remove(fid);
        },
        clean_feed: function(fid) {
            Posts.remove({feedId: fid});
            console.log("cleaning feed", fid);
        }
    });
    Meteor.startup(function () {
        function getParams(str) {
            var params = str.split(';').reduce(function (params, param) {
                var parts = param.split('=').map(function (part) {
                    return part.trim();
                });
                if (parts.length === 2) {
                    params[parts[0]] = parts[1];
                }
                return params;
            }, {});
            return params;
        }

        function updateFeeds() {
            Feeds.find().forEach(function(feed) {
                var natural = Nlp;

                var restoredClassifier = feed.classifier && natural.BayesClassifier.restore(JSON.parse(feed.classifier));
                var allow_classifying = restoredClassifier && restoredClassifier.classifier.totalExamples > 10;

                var request = Npm.require("request");
                var good_words = [];
                var bad_words = [];

                if (feed.good_words) {
                    good_words = _.compact(_.map(feed.good_words.split('\n'), function(w) { return w.replace(' ', ''); }));
                }
                if (feed.bad_words) {
                    bad_words = _.compact(_.map(feed.bad_words.split('\n'), function(w) { return w.replace(' ', ''); }));
                }

                HTTP.get(feed.url, function(err, result) {
                    var charset = getParams(result.headers['content-type']).charset;
                    // TODO: decoding

                    xml2js.parseString(result.content, function(err, data) {
                        console.log(data.rss.channel[0].item[0].title[0]);
                        _.each(data.rss.channel[0].item, function(post) {
                            var post_url = post.link[0] || post.guid[0]['_'];
                            var full_text = post.title + ' ' + post.summary;
                            var cat = allow_classifying && restoredClassifier.classify(full_text);

                            if (_.any(bad_words, function(w) { return full_text.indexOf(w) > -1; })) {
                                cat = '3 bad';
                            }
                            if (_.any(good_words, function(w) { return full_text.indexOf(w) > -1; })) {
                                cat = '1 good';
                            }

                            var title = post.title[0];
                            var description = post.description[0];

                            var update_data = {
                                url: post_url,
                                feedId: feed._id,
                                userId: feed.userId,
                                title: title,
                                summary: description,
                                category: cat || '2 neutral',
                                published_at: post.pubDate[0]
                            }

                            var existing = Posts.findOne({
                                url: update_data.url,
                                feedId: update_data.feedId,
                                userId: update_data.userId
                            });
                            if (!existing) {
                                Posts.insert(update_data);
                            }
                        });
                    })
                });

                var classifier = new natural.BayesClassifier();
                Posts.find({feedId: feed._id}).forEach(function(p) {
                    classifier.addDocument(p.title + ' ' + p.summary, p.category || '2 neutral');
                })
                classifier.train()
                Feeds.update(feed._id, {$set: {classifier: JSON.stringify(classifier)}});
            });

            MyCron.addJob(10, updateFeeds);
        }

        updateFeeds();
    });
}
