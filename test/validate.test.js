var geobuf = require('../'),
    _ = require('underscore'),
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

var featLine = {
    type: 'Feature',
    geometry: {
        type: 'LineString',
        coordinates: [[0, 0], [10, 10], [20, 10]]
    },
    properties: {
    }
};

test('proto', function(t) {
    t.doesNotThrow(function() {
        var builder = geobuf.builder();
        t.ok(builder, 'builder is truthy');
    }, 'can be constructed');
    t.end();
})

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
    t.deepEqual(geobuf.geobufToFeature(geobuf.featureToGeobuf(feat)), feat, 'point');
    t.deepEqual(geobuf.geobufToFeature(geobuf.featureToGeobuf(featLine)), featLine, 'linestring');
    t.end();
});
