'use strict';

var geobuf = require('../'),
    geojsonFixtures = require('geojson-fixtures').all,
    Pbf = require('pbf'),
    test = require('tap').test,
    fs = require('fs'),
    os = require('os'),
    crypto = require('crypto'),
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

test('concatenation', function (t) {
    var output = path.join(os.tmpdir(), crypto.randomBytes(8).toString('hex'));
    var outStream = fs.createWriteStream(output);
    var props = fs.createReadStream(path.join(__dirname, 'fixtures', 'props.pbf'));
    var propsJson = fs.readFileSync(path.join(__dirname, 'fixtures', 'props.json'), 'utf8');
    propsJson = JSON.parse(propsJson);
    var multi = fs.createReadStream(path.join(__dirname, 'fixtures', 'single-multipoly.pbf'));
    var multiJson = fs.readFileSync(path.join(__dirname, 'fixtures', 'single-multipoly.json'), 'utf8');
    multiJson = JSON.parse(multiJson);

    props.on('end', function () {
        multi.pipe(outStream).on('finish', checkResult);
    }).pipe(outStream, {end: false});

    function checkResult() {
        var buf = fs.readFileSync(output);
        var result = geobuf.decode(new Pbf(buf));
        t.deepEqual(result, [propsJson, multiJson]);
        t.end();
    }
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
