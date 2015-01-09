var geobuf = require('../'),
    geojsonFixtures = require('geojson-fixtures'),
    Pbf = require('pbf'),
    test = require('tap').test;

test('roundtrip GeoJSON', function(t) {
    for (var type in geojsonFixtures) {
        for (var name in geojsonFixtures[type]) {
            var geojson = geojsonFixtures[type][name];
            if (name === 'polygon-xyz') continue; // missing coord data not supported yet
            t.same(geobuf.decode(new Pbf(geobuf.encode(geojson, new Pbf()))), geojson, type + ' ' + name);
        }
    }
    t.end();
});
