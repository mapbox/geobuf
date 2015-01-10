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
    test('roundtrip TopoJSON: ' + files[i], roundtripTest(getJSON(files[i] + '.topo.json')));
}

test('roundtrip custom properties', roundtripTest(getJSON('props.json')));

function roundtripTest(geojson) {
    return function (t) {
        t.same(geobuf.decode(new Pbf(geobuf.encode(geojson, new Pbf()))), geojson);
        t.end();
    };
}

function getJSON(name) {
    return JSON.parse(fs.readFileSync(__dirname + '/fixtures/' + name));
}
