var MongoCompiler = require('./compiler');
var ObjectID = require('mongodb').ObjectID;

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
    var keys = Object.keys(config.fieldMap || {});
    keys.forEach(function(key) {
      var prop = config.fieldMap[key] || key;
      if (key.indexOf('.') === -1) {
        obj[key] = entity[prop];
      } else {
        var parts = prop.split('.');
        var part = parts.reduce(function(prev, cur) {
          if (Array.isArray(prev)) {
            return prev.map(function(item) {
              return item[cur];
            }); 
          } else if (prev.hasOwnProperty(cur)) {
            return prev[cur];
          }
        }, entity)

        obj[key] = part;
      }
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

            if (field.indexOf('.') === -1) {
              obj[f] = doc[field];
            } else {
              var parts = field.split('.');
              var part = parts.reduce(function(prev, cur) {
                if (Array.isArray(prev)) {
                  return prev.map(function(item) {
                    return item[cur];
                  }); 
                } else if (prev.hasOwnProperty(cur)) {
                  return prev[cur];
                }
              }, doc)

              obj[f] = part;
            }
          });
        } else {
          obj = doc;
        };

        return convertToModel(query.modelConfig, obj, query.modelConfig.isBare);
      });

      cb(null, entities);
    });
  }
};

MongoSession.prototype.get = function(query, id, cb) {
  var config = query.modelConfig;

  var _id = new ObjectID(id);

  this.db.collection(config.collection).findOne({ _id: _id }, function(err, doc) {
    if (err) {
      return cb(err);
    }

    var model = convertToModel(config, doc, config.isBare);

    cb(null, model);
  });
};

MongoSession.create = function(options) {
  return new MongoSession(options);
};
