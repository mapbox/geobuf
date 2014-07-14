var geobuf = require('../'),
    test = require('tap').test;

test('proto', function(t) {
    t.doesNotThrow(function() {
        var builder = geobuf.builder();
        t.ok(builder, 'builder is truthy');
    }, 'can be constructed');
    t.end();
})

test('featureToGeobuf', function(t) {
    var buf = geobuf.featureToGeobuf({
        type: 'Feature',
        geometry: {
            type: 'Point',
            coordinates: [0, 0]
        },
        properties: {
            name: 'Hello world'
        }
    });

    t.ok(buf, 'encodes a message');

    t.end();
});
