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

    Template.posts.events({
        'click .post-good': function (e) {
            Posts.update(this._id, {$set: {read: true, category: 'good'}});
        },
        'click .post-bad': function (e) {
            Posts.update(this._id, {$set: {read: true, category: 'bad'}});
        },
        'change form.add_feed input': function (e) {
            Session.set('feed_url', e.target.value);
        },
        'click form.add_feed button': function (e) {
            var url = Session.get('feed_url');
            var existing = Feeds.findOne({url: url});
            if (!existing) {
                var fid = Feeds.insert({
                    url: url,
                    userId: Meteor.userId()
                });
                console.log('New feed', fid, Meteor.userId());
            }
        }
    });
}

if (Meteor.isServer) {
    Meteor.methods({
        push_post: function(post) {
            var existing = Posts.findOne({url: post.url, feedId: post.feedId, userId: post.userId});
            if (!existing) {
                Posts.insert(post);
            }
        },
        reset_classifiers: function () {
            Posts.remove('*.category');
            Feeds.remove('*.classifier');
        },
        reset_feeds: function () {
            Posts.remove({});
            Feeds.remove({});
        },
        save_classifier: function (fid, json) {
            Feeds.update(fid, {$set: {classifier: json}});
        },
        clean_feed: function(fid) {
            Posts.remove({feedId: fid});
            console.log("cleaning feed", fid);
        }
    });
    Meteor.startup(function () {
    });
}
