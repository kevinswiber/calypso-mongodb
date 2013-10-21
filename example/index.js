var calypso = require('calypso');
var Query = calypso.Query;
var MongoDriver = require('../');

var engine = calypso.configure({
  driver: MongoDriver.create({
    uri: 'mongodb://localhost:27017/crunchbase'
  }),
  mappings: [CompanyMapping]
});

engine.build(function(err, connection) {
  var session = connection.createSession();

  var query = Query.of('companies')
    .ql('SELECT name, products.name AS products, founded_year ' +
        'WHERE founded_year >= @year ' +
        'ORDER BY founded_year DESC, name')
    .params({ year: 2006 })

  session.find(query, function(err, companies) {
    console.log(companies);
    connection.close();
  });
});

// Output:
//
// [
//   {
//     name: 'Airbnb',
//     products: [],
//     founded_year: 2007
//   },
//   {
//     name: 'Spotify',
//     products: [],
//     founded_year: 2006
//   },
//   {
//     name: 'TripIt',
//     products: [ 'TripIt' ],
//     founded_year: 2006
//   },
//   {
//     name: 'Twitter',
//     products: [ 'Twitter Blocks', 'Twicco' ],
//     founded_year: 2006
//   }
// ]
