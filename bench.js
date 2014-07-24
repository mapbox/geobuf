var Benchmark = require('benchmark');
global.geobuf = require('./');
global.geobuf2 = require('./index2.js');
global.geojsonFixtures = require('geojson-fixtures');

var suite = new Benchmark.Suite();

// add tests
suite
.add({
    name: 'original',
    fn: function() {
        for (var k in global.geojsonFixtures.geometry) {
            var ex = { type: 'Feature', properties: {}, geometry: global.geojsonFixtures.geometry[k] };
            global.geobuf.geobufToFeature(global.geobuf.featureToGeobuf(ex).encode());
        }
    },
    setup: function() {
    }
})
.add({
    name: 'classic',
    fn: function() {
        try {
        for (var k in global.geojsonFixtures.geometry) {
            var ex = { type: 'Feature', properties: {}, geometry: global.geojsonFixtures.geometry[k] };
            global.geobuf2.geobufToFeature(global.geobuf2.featureToGeobuf(ex).encode());
        }
        } catch(e) { throw e; }
    },
    setup: function() {
    }
})
// add listeners
.on('cycle', function(event) {
  console.log(String(event.target));
})
.on('complete', function() {
  console.log('Fastest is ' + this.filter('fastest').pluck('name'));
})
// run async
.run({ 'async': true });
