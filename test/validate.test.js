'use strict';

var geobuf = require('../'),
    geojsonFixtures = require('geojson-fixtures').all,
    Pbf = require('pbf'),
    test = require('tap').test,
    fs = require('fs'),
    path = require('path');

for (var name in geojsonFixtures) {
    if (name === 'polygon-xyz-0-7') continue; // missing coord data not supported yet
    test('roundtrip GeoJSON: ' + name, roundtripTest(geojsonFixtures[name]));
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
    return JSON.parse(fs.readFileSync(path.join(__dirname, '/fixtures/' + name)));
}
