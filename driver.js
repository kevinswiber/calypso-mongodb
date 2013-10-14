var Connection = require('./connection');

var MongoDriver = module.exports = function(options) {
  this.options = options;
};

MongoDriver.prototype.init = function(cb) {
  var connection = Connection.create(this.options);
  connection.init(cb);
};

MongoDriver.create = function(options, cb) {
  var driver = new MongoDriver(options);
  return driver;
};
