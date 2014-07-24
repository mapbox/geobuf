var geobuf = require('../'),
    _ = require('underscore'),
    geojsonFixtures = require('geojson-fixtures'),
    test = require('tap').test;

var feat = {
    type: 'Feature',
    geometry: {
        type: 'Point',
        coordinates: [0, 0]
    },
    properties: {
        name: 'Hello world',
        b: 2,
        thing: true
    }
};

test('featureToGeobuf', function(t) {
    var buf = geobuf.featureToGeobuf(feat);
    t.ok(buf, 'encodes a message');
    t.end();
});

test('featureToGeobuf - throws', function(t) {
    t.throws(function() {
        geobuf.featureToGeobuf(_.extend({}, feat, {type:'huh'}));
    });
    t.throws(function() {
        geobuf.featureToGeobuf(_.extend({}, feat, {geometry:{type:'huh'}}));
    });
    t.end();
});

test('geobufToFeature', function(t) {
    for (var k in geojsonFixtures.geometry) {
        var ex = _.extend({}, feat, { geometry: geojsonFixtures.geometry[k] });
        t.deepEqual(geobuf.geobufToFeature(geobuf.featureToGeobuf(ex).encode()), ex, k);
    }
    t.end();
});

test('featurecollection', function(t) {
    for (var k in geojsonFixtures.featurecollection) {
        var ex = geojsonFixtures.featurecollection[k];
        t.ok(geobuf.featureCollectionToGeobuf(ex).encode(), k);
    }
    t.end();
});
