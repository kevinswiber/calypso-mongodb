var calypso = require('calypso');
var Query = calypso.Query;
var MongoDriver = require('calypso-mongodb');

var Company = function() {
  this.name = null;
  this.year = null;
  this.fundingAmount = null;
};

var CompanyMapping = function(mapping) {
  mapping
    .of(Company)
    .at('companies')
    .map('name')
    .map('year', { to: 'founded_year' })
    .map('fundingAmount', { to: 'total_money_raised' })
};

var engine = calypso.configure({
  driver: MongoDriver.create({
    uri: 'mongodb://localhost:27017/crunchbase'
  }),
  mappings: [CompanyMapping]
});

engine.build(function(err, connection) {
  var session = connection.createSession();

  //var query = Query.of(Company)
    //.where('year', { gte: 2006 })

  var query = Query.of('companies')
    .ql('select name, founded_year where founded_year >= @year')
    .params({ year: 2006 })

  session.find(query, function(err, books) {
    console.log(books);
    connection.close();
  });
});
