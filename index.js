var ProtoBuf = require('protobufjs'),
    assert = require('assert'),
    _ = require('underscore'),
    fs = require('fs');

module.exports.builder = builder;
module.exports.featureToGeobuf = featureToGeobuf;
module.exports.geobufToFeature = geobufToFeature;

function builder() {
    var b = ProtoBuf.loadProtoFile(__dirname + '/geobuf.proto');
    return b;
}

var geotypeMap = {
    POINT: 'Point',
    MULTIPOINT: 'MultiPoint',
    LINESTRING: 'LineString',
    MULTILINESTRING: 'MultiLineString',
    POLYGON: 'Polygon',
    MULTIPOLYGON: 'MultiPolygon',
};

var geotypeMapRev = _.invert(geotypeMap);

function featureToGeobuf(geojson) {

    assert.equal(geojson.type, 'Feature');
    assert.equal(typeof geojson.geometry, 'object');

    var b = builder();
    var feature = new (b.build('feature'))();
    var geometry = new (b.build('geometry'))();
    var geometryTypes = b.build('geometry.Type');

    if (geometryTypes[geotypeMapRev[geojson.geometry.type]] === undefined) {
        assert.fail('geometry type unknown');
    }
    geometry.type = geometryTypes[geotypeMapRev[geojson.geometry.type]];


    var i, j;

    if (geojson.geometry.type === 'Point') {
        var coordArray = new (b.build('coord_array'))();
        for (i = 0; i < geojson.geometry.coordinates.length; i++) {
            coordArray.add('coords', geojson.geometry.coordinates[i]);
        }
        geometry.add('coord_array', coordArray);
    } else if (geojson.geometry.type === 'LineString' ||
            geojson.geometry.type === 'MultiPoint') {
        var coordArray = new (b.build('coord_array'))();
        for (i = 0; i < geojson.geometry.coordinates.length; i++) {
            for (j = 0; j < geojson.geometry.coordinates[i].length; j++) {
                coordArray.add('coords', geojson.geometry.coordinates[i][j]);
            }
        }
        geometry.add('coord_array', coordArray);
    } else if (geojson.geometry.type === 'Polygon' ||
              geojson.geometry.type === 'MultiLineString') {
        for (i = 0; i < geojson.geometry.coordinates.length; i++) {
            var coordArray = new (b.build('coord_array'))();
            for (j = 0; j < geojson.geometry.coordinates[i].length; j++) {
                for (k = 0; k < geojson.geometry.coordinates[i][j].length; k++) {
                    coordArray.add('coords', geojson.geometry.coordinates[i][j][k]);
                }
            }
            geometry.add('coord_array', coordArray);
        }
    }

    var propBuild = b.build('property');
    var valueBuild = b.build('value');
    for (var k in geojson.properties) {
        var p = new propBuild(),
            val = new valueBuild(),
            v = geojson.properties[k];

        p.set('key', k);
        switch (typeof v) {
            case 'number':
                val.set('float_value',  v);
                break;
            case 'boolean':
                val.set('bool_value',  v);
                break;
            case 'string':
                val.set('string_value',  (v || '').toString());
                break;
            default:
                val.set('string_value',  (v || '').toString());
                break;
        }

        p.set('value', val);
        feature.add('properties', p);
    }


    feature.add('geometries', geometry);

    return feature.encode();
}

function geobufToFeature(buf) {
    var b = builder();
    var Feature = b.build('feature');
    var feature = Feature.decode(buf);
    var geojson = {
        type: 'Feature',
        properties: {},
        geometry: {}
    };
    for (var i = 0; i < feature.properties.length; i++) {
        // inefficient!
        geojson.properties[feature.properties[i].key] = _.find(
            _.values(feature.properties[i].value), truthy);
    }
    function truthy(val) {
        return val !== null;
    }
    var geometryTypes = _.invert(b.build('geometry.Type'));
    geojson.geometry.type = geotypeMap[geometryTypes[feature.geometries[0].type]];
    var arr = feature.geometries[0].coord_array[0];
    geojson.geometry.coordinates = [];
    if (geojson.geometry.type === 'Point') {
        for (i = 0; i < arr.coords.length; i++) {
            geojson.geometry.coordinates.push(arr.coords[i].toNumber());
        }
    } else if (geojson.geometry.type === 'LineString' ||
        geojson.geometry.type === 'MultiPoint') {
        var coord = [];
        for (i = 0; i < arr.coords.length; i++) {
            coord.push(arr.coords[i].toNumber());
            if (coord.length === 2) {
                geojson.geometry.coordinates.push(coord);
                coord = [];
            }
        }
    } else if (geojson.geometry.type === 'Polygon' ||
        geojson.geometry.type === 'MultiLineString') {
        var coord = [], ca = [];
        for (i = 0; i < feature.geometries[0].coord_array.length; i++) {
            ca = [];
            for (j = 0; j < feature.geometries[0].coord_array[i].coords.length; j++) {
                coord.push(feature.geometries[0].coord_array[i].coords[j].toNumber());
                if (coord.length === 2) {
                    ca.push(coord);
                    coord = [];
                }
            }
            geojson.geometry.coordinates.push(ca);
        }
    }
    return geojson;
}
