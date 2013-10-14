var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;
var Session = require('./session');

var MongoConnection = module.exports = function(options) {
  this.uri = options.uri;
  this.db = null;
  this.cache = {};
};

MongoConnection.prototype.init = function(cb) {
  var self = this;
  MongoClient.connect(this.uri, function(err, db) {
    if (err) {
      return cb(err);
    }

    self.db = db;
    cb(null, self);
  });
};

MongoConnection.prototype.createSession = function() {
  return Session.create(this.db, this.cache);
};

MongoConnection.prototype.close = function(cb) {
  this.db.close(cb);
};

MongoConnection.create = function(options) {
  var connection = new MongoConnection(options);
  return connection;
};
