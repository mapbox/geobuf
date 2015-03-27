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

test('roundtrip custom properties', roundtripTest(getJSON('props.json')));
test('roundtrip single-ring MultiPolygon', roundtripTest(getJSON('single-multipoly.json')));

test('roundtrip valid closed polygon with high-precision coordinates', function (t) {
    var geojson = getJSON('precision.json');
    var pbf = new Pbf(geobuf.encode(geojson, new Pbf()));
    var ring = geobuf.decode(pbf).features[0].geometry.coordinates[0];
    t.same(ring[0], ring[4]);
    t.end();
});

function roundtripTest(geojson) {
    return function (t) {
        t.same(geobuf.decode(new Pbf(geobuf.encode(geojson, new Pbf()))), geojson);
        t.end();
    };
}

function getJSON(name) {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '/fixtures/' + name)));
}
