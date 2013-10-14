var MongoCompiler = require('./compiler');

var MongoSession = module.exports = function(db, cache) {
  this.db = db;
  this.cache = cache || {};
};

function convertToModel(config, entity, isBare) {
  var obj;
  if (isBare) {
    obj = entity;
  } else {
    obj = Object.create(config.constructor.prototype);
    var keys = Object.keys(config.fieldMap);
    keys.forEach(function(key) {
      var prop = config.fieldMap[key] || key;
      obj[key] = entity[prop];
    });
  }

  return obj;
}

MongoSession.prototype.find = function(query, cb) {
  if (query) {
    var compiler = new MongoCompiler(this.cache);
    var compiled = compiler.compile({ query: query });

    fieldMap = compiled.fieldMap;
    filter = compiled.filter;

    var opts = {};

    if (compiled.fields) {
      opts.fields = compiled.fields;
    }

    if (compiled.sort) {
      opts.sort = compiled.sort;
    }

    this.db.collection(compiled.collection).find(compiled.filter, opts).toArray(function(err, docs) {
      if (err) {
        return cb(err);
      }

      var entities = docs.map(function(doc) {
        var obj = {};
        var keys = Object.keys(compiled.fields || {});
        if (keys.length && query.modelConfig.isBare) {
          keys.forEach(function(field, i) {
            var f = field;
            if (compiled.fieldMap) {
              f = compiled.fieldMap[field] || field;
            }

            obj[f] = doc[field];
          });
        } else {
          obj = doc;
        };

        return convertToModel(query.modelConfig, obj, query.modelConfig.isBare);
      });

      return cb(null, entities);
    });
  }

  /*if (!query) {
    query = 'select *';
  }

  var fn = this.compiler.compile(collection, query);
  fn(cb);*/
};

MongoSession.prototype.get = function(query, id, cb) {
  var ql = 'select * where _id="' + id + '"';
  this.find(collection, ql, cb);
};

MongoSession.create = function(options) {
  return new MongoSession(options);
};
