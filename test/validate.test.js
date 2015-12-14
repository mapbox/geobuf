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

test('roundtrip a line with potential accumulating error', function (t) {
    // Generate a line of 40 points. Each point's x coordinate, x[n] is at x[n - 1] + 1 + d, where
    // d is a floating point number that just rounds to 0 at 6 decimal places, i.e. 0.00000049.
    // Therefore a delta compression method that only computes x[n] - x[n - 1] and rounds to 6 d.p.
    // will get a constant delta of 1.000000. The result will be an accumulated error along the
    // line of 0.00000049 * 40 = 0.0000196 over the full length.
    var feature = {
        'type': 'MultiPolygon',
        'coordinates': [[[ ]]]
    };
    var points = 40;
    // X coordinates [0, 1.00000049,  2.00000098,  3.00000147,  4.00000196, ...,
    //                  37.00001813, 38.00001862, 39.00001911, 40.00001960, 0]
    for (var i = 0; i <= points; i++) {
        feature.coordinates[0][0].push([i * 1.00000049, 0]);
    }
    feature.coordinates[0][0].push([0, 0]);
    var roundTripped = geobuf.decode(new Pbf(geobuf.encode(feature, new Pbf())));
    function roundX(z) {
        return Math.round(z[0] * 1000000) / 1000000.0;
    }
    var xsOrig = feature.coordinates[0][0].map(roundX);
    var xsRoundTripped = roundTripped.coordinates[0][0].map(roundX);
    t.same(xsRoundTripped, xsOrig);
    t.end();
});

test('roundtrip a circle with potential accumulating error', function (t) {
    // Generate an approximate circle with 16 points around.
    var feature = {
        'type': 'MultiPolygon',
        'coordinates': [[[ ]]]
    };
    var points = 16;
    for (var i = 0; i <= points; i++) {
        feature.coordinates[0][0].push([Math.cos(Math.PI * 2.0 * i / points),
                                        Math.sin(Math.PI * 2.0 * i / points)]);
    }
    var roundTripped = geobuf.decode(new Pbf(geobuf.encode(feature, new Pbf())));
    function roundCoord(z) {
        return [Math.round(z[0] * 1000000), Math.round(z[1] * 1000000)];
    }
    var ringOrig = feature.coordinates[0][0].map(roundCoord);
    var ringRoundTripped = roundTripped.coordinates[0][0].map(roundCoord);
    t.same(ringRoundTripped, ringOrig);
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
