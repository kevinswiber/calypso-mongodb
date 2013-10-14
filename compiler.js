var mongodb = require('mongodb');
var ObjectID = mongodb.ObjectID;
var Parser = require('calypso').Parser;

var MongoCompiler = module.exports = function(cache) {
  this.fields = [];
  this.conjunctions = [];
  this.disjunctions = [];
  this.andPredicates = [];
  this.orPredicates = [];
  this.sorts = [];
  this.collection = null;
  this.filter = [];
  this.lastOr = [];
  this.ors = [];

  this.cache = cache;

  this.params = {};
  this.modelFieldMap = null;
};

MongoCompiler.prototype.compile = function(options) {
  this.modelFieldMap = options.query.modelConfig.fieldMap;
  var config = options.query.modelConfig;
  var query = options.query.build();
  
  if (query.type === 'ast') {
    query.value.accept(this);
  } else if (query.type === 'ql') {
    var ql = query.value.ql;
    var ast;
    if (this.cache.hasOwnProperty(ql)) {
      ast = this.cache[ql];
    } else {
      ast = Parser.parse(ql);
      this.cache[ql] = ast;
    }

    this.params = query.value.params;
    ast.accept(this);
  } else if (query.type === 'raw') {
    return query.value;
  }

  var fieldMap = {};
  var fields = [];
  var hasFields = false;
  var hasFieldMap = false;
  
  this.fields.forEach(function(field) {
    if (field.name) {
      fields.push(field.name);
      hasFields = true;
      if (field.alias) {
        fieldMap[field.name] = field.alias;
        hasFieldMap = true;
      }
    }
  });

  var self = this;
  var mongoFields;
  var filter = {};
  var sorts = {};

  if (!fields.length || fields[0] === '*') {
    mongoFields = null; 
  } else {
    mongoFields = {};
    fields.forEach(function(field) {
      mongoFields[field] = 1;
    });
  }

  var filter = {};
  this.filter.forEach(function(condition) {
    Object.keys(condition).forEach(function(k) {
      filter[k] = condition[k];
    });
  });

  if (this.sorts) {
    this.sorts.forEach(function(sort) {
      var val = sort.direction === 'asc' ? 1 : -1;
      sorts[sort.field] = val;
    });
  }

  return {
    collection: config.collection,
    filter: filter,
    sort: sorts,
    fields: hasFields ? mongoFields : null,
    fieldMap: hasFieldMap ? fieldMap : null
  };
};

MongoCompiler.prototype.old_compile = function(collection, ql) {
  this.collection = collection;

  var root = Parser.parse(ql);
  root.accept(this);

  var self = this;
  var fields;
  var filter = {};
  var sorts = {};

  if (!self.fields.length || self.fields[0] === '*') {
    fields = null; 
  } else {
    fields = {};
    self.fields.forEach(function(field) {
      fields[field] = 1;
    });
  }

  var filter = {};
  this.filter.forEach(function(condition) {
    Object.keys(condition).forEach(function(k) {
      filter[k] = condition[k];
    });
  });

  if (this.sorts) {
    this.sorts.forEach(function(sort) {
      var val = sort.direction === 'asc' ? 1 : -1;
      sorts[sort.field] = val;
    });
  }

  //var collectionString = inflect.singularize(collection);
  return function(cb) {
    var callback = function(err, docs) {
      docs = docs.map(function(doc) {
        var id = doc._id;
        if (doc['_id'] && self.fields.indexOf('_id') === -1 && self.fields.indexOf('*') === -1) {
          delete doc['_id'];
        }
        return { id: id, type: collectionString, value: doc };
      });
      cb(err, { rows: docs, count: docs.length });
    };

    var options = {};

    if (fields) {
      options.fields = fields;
    }

    if (sorts && Object.keys(sorts).length) {
      options.sort = sorts;
    }

    self.db.collection(collection).find(filter, options).toArray(callback);
  };
};

MongoCompiler.prototype.visit = function(node) {
  this['visit' + node.type](node);
};

MongoCompiler.prototype.visitSelectStatement = function(statement) {
  statement.fieldListNode.accept(this);
  if (statement.filterNode) {
    statement.filterNode.accept(this);
  }

  if (statement.orderByNode) {
    statement.orderByNode.accept(this);
  }
};

MongoCompiler.prototype.visitFieldList = function(fieldList) {
  this.fields = fieldList.fields;
};

MongoCompiler.prototype.visitFilter = function(filterList) {
  filterList.expression.accept(this);
};

MongoCompiler.prototype.visitOrderBy = function(orderBy) {
  this.sorts = orderBy.sortList.sorts;
};

MongoCompiler.prototype.visitConjunction = function(conjunction) {
  if (conjunction.isNegated) {
    conjunction.left.negate();
    conjunction.right.negate();
  }

  var obj = {};
  conjunction.left.obj = conjunction.right.obj = obj;

  conjunction.left.dir = 'left';
  conjunction.right.dir = 'right';
  conjunction.left.accept(this);
  conjunction.right.accept(this);
};

MongoCompiler.prototype.visitDisjunction = function(disjunction) {
  this.ors.push({ isNegated: disjunction.isNegated, value: [] });
  disjunction.left.accept(this);
  disjunction.right.accept(this);
};

MongoCompiler.prototype.visitComparisonPredicate = function(comparison) {
  if (this.modelFieldMap[comparison.field]) {
    comparison.field = this.modelFieldMap[comparison.field];
  }

  if (typeof comparison.value === 'string'
      && comparison.value[0] === '@' && this.params) {
    comparison.value = this.params[comparison.value.substring(1)];
  }

  var obj = {};

  var val;

  if (typeof comparison.value === 'boolean' || comparison.value == null) {
    val = comparison.value
  } else {
    val = comparison.value[0] === '\'' || comparison.value[0] === '"'
      ? comparison.value.slice(1, -1)
      : Number(comparison.value);
  }

  var mongoVal;
  switch(comparison.operator) {
    case 'eq': mongoVal = val; break;
    case 'lt': mongoVal = { $lt: val }; break;
    case 'lte': mongoVal = { $lte: val }; break;
    case 'gt': mongoVal = { $gt: val }; break;
    case 'gte': mongoVal = { $gte: val }; break;
  }

  if (comparison.isNegated) {
    var op = comparison.operator === 'eq' ? '$ne' : '$not';
    var v = {};
    v[op] = mongoVal;
    mongoVal = v;
  }

  obj[comparison.field] = mongoVal;

  var cur = obj;
  if (comparison.obj) {
    if (comparison.obj[comparison.field]) {
      throw new Error('Syntax error: multiple instances of `' + comparison.field + '`.');
    }
    comparison.obj[comparison.field] = obj[comparison.field];
    if (comparison.dir === 'right') {
      if (this.ors.length) {
        cur = comparison.obj;
      } else {
        this.filter.push(comparison.obj);
      }
    }
  }

  if (this.ors.length && (!comparison.obj || !comparison.dir || comparison.dir === 'right')) {
    var or = this.ors[this.ors.length - 1];
    if (or.value.length < 2) {
      or.value.push(cur);
    }
    
    while (this.ors.length && (or = this.ors[this.ors.length - 1]).value.length == 2) {
      var lastOr = this.ors.pop();
      if (this.ors.length && this.ors[this.ors.length - 1].value.length < 2) {
        var dis = {};
        var op = lastOr.isNegated ? '$nor' : '$or';
        dis[op] = lastOr.value;
        this.ors[this.ors.length - 1].value.push(dis);
      } else  {
        var dis = {};
        var op = lastOr.isNegated ? '$nor' : '$or';
        dis[op] = lastOr.value;
        this.filter.push(dis);
      }
    }
  } else if (!comparison.obj) {
    this.filter.push(cur);
  }
};

module.exports = function(options) { return new MongoCompiler(options); };
