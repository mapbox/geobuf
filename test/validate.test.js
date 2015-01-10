var geobuf = require('../'),
    geojsonFixtures = require('geojson-fixtures'),
    Pbf = require('pbf'),
    test = require('tap').test,
    fs = require('fs');

for (var type in geojsonFixtures) {
    for (var name in geojsonFixtures[type]) {
        if (name === 'polygon-xyz') continue; // missing coord data not supported yet
        test('roundtrip GeoJSON: ' + type + ' ' + name, roundtripTest(geojsonFixtures[type][name]));
    }
}

var files = ['no-transform', 'simple', 'us-states'];
for (var i = 0; i < files.length; i++) {
    var geojson = JSON.parse(fs.readFileSync(__dirname + '/fixtures/' + files[i] + '.topo.json'));
    test('roundtrip TopoJSON: ' + files[i], roundtripTest(geojson));
}

function roundtripTest(geojson) {
    return function (t) {
        t.same(geobuf.decode(new Pbf(geobuf.encode(geojson, new Pbf()))), geojson);
        t.end();
    }
}
