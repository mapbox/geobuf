var ProtoBuf = require('protobufjs'),
    assert = require('assert'),
    fs = require('fs');

module.exports.builder = builder;
module.exports.featureToGeobuf = featureToGeobuf;

function builder() {
    var b = ProtoBuf.loadProtoFile(__dirname + '/geobuf.proto');
    return b;
}

function featureToGeobuf(geojson) {

    assert.equal(geojson.type, 'Feature');
    assert.equal(typeof geojson.geometry, 'object');

    var b = builder();
    var feature = new (b.build('feature'))();
    var geometry = new (b.build('geometry'))();
    var geometryTypes = b.build('geometry.Type');

    if (geometryTypes[geojson.geometry.type.toUpperCase()] === undefined) {
        assert.fail('geometry type unknown');
    }
    geometry.type = geometryTypes[geojson.geometry.type.toUpperCase()];

    var coordArray = new (b.build('coord_array'))();
    if (geojson.geometry.type === 'Point') {
        for (var i = 0; i < geojson.geometry.coordinates.length; i++) {
            coordArray.add('coords', geojson.geometry.coordinates[i]);
        }
    }

    var propBuild = b.build('property');
    var valueBuild = b.build('value');
    for (var k in geojson.properties) {
        var p = new propBuild(),
            val = new valueBuild(),
            v = geojson.properties[k];
        p.set('key', k);
        if (typeof v === 'string') {
            val.set('string_value',  v);
        }
        p.set('value', val);
        feature.add('properties', p);
    }

    geometry.add('coord_array', coordArray);

    return feature.encode();
}
