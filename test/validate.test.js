var geobuf = require('../'),
    test = require('tap').test;

test('proto', function(t) {
    t.doesNotThrow(function() {
        var builder = geobuf.builder();
        t.ok(builder, 'builder is truthy');
    }, 'can be constructed');
    t.end();
})
