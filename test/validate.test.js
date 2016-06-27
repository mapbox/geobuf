var geobuf = require('../'),
    _ = require('underscore'),
    geojsonFixtures = require('geojson-fixtures'),
    test = require('tap').test,
    fs = require('fs'),
    path = require('path');

var feat = {
    type: 'Feature',
    geometry: {
        type: 'Point',
        coordinates: [0, 0]
    },
    properties: {
        name: 'Hello world',
        b: 2,
        thing: true,
        nested: {
            attr: 'value',
            array: [1, 2, 'a', {foo: 'bar'}, [1, 2], {}, []],
            value: null,
            obj: {foo: 'bar'},
            empty: {}
        },
        array: [1, 2, 'a', {foo: 'bar'}, [1, 2], {}, []],
        value: null
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
        t.comment(k + ': ' + geobuf.featureToGeobuf(ex).encode().toBuffer().length);
        t.deepEqual(geobuf.geobufToFeature(geobuf.featureToGeobuf(ex).encode()), ex, k);
    }
    var withId = _.extend({id: 'i-can-haz-id'}, feat, { geometry: geojsonFixtures.geometry[k] });
    t.deepEqual(geobuf.geobufToFeature(geobuf.featureToGeobuf(withId).encode()), withId, k + 'with id');
    t.end();
});

test('featurecollection', function(t) {
    for (var k in geojsonFixtures.featurecollection) {
        var ex = geojsonFixtures.featurecollection[k];
        t.ok(geobuf.featureCollectionToGeobuf(ex).encode(), k);
    }
    t.end();
});

test('numeric properties round-trip', function(t) {
    var feature = {
        type: 'Feature',
        properties: { num: 123456789012345 },
        geometry: { type: 'Point', coordinates: [0, 0] }
    };

    var buf = geobuf.featureToGeobuf(feature).toBuffer();
    var roundtrip = geobuf.geobufToFeature(buf);

    t.equal(roundtrip.properties.num, feature.properties.num, 'round-trips large numeric properties');
    t.end();
});

test('can decode geobuf where numeric property is float-encoded', function(t) {
    var buf = fs.readFileSync(path.resolve(__dirname, 'fixtures', 'float-encoded.geobuf'));
    var feature = geobuf.geobufToFeature(buf);
    t.equal(typeof feature.properties.num, 'number', 'decoded numeric property');
    t.end();
});
