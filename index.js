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

    addGeometry(geojson.geometry);

    function addGeometry(inputGeom) {
        if (inputGeom.type === 'GeometryCollection') {
            inputGeom.geometries.forEach(function(g) {
                addGeometry(g);
            });
            return;
        }
        var geometry = new (b.build('geometry'))();
        var geometryTypes = b.build('geometry.Type');
        if (geometryTypes[geotypeMapRev[inputGeom.type]] === undefined) {
            assert.fail('geometry type unknown', inputGeom.type);
        }
        geometry.type = geometryTypes[geotypeMapRev[inputGeom.type]];

        var i, j, k, l, coordArray, multiArray;
        var CoordArray = b.build('coord_array');
        var MultiArray = b.build('multi_array');

        if (inputGeom.type === 'Point') {
            coordArray = new CoordArray();
            for (i = 0; i < inputGeom.coordinates.length; i++) {
                coordArray.add('coords', inputGeom.coordinates[i] * 1e6);
            }
            geometry.add('coord_array', coordArray);
        } else if (inputGeom.type === 'LineString' ||
                inputGeom.type === 'MultiPoint') {
            coordArray = new CoordArray();
            for (i = 0; i < inputGeom.coordinates.length; i++) {
                for (j = 0; j < inputGeom.coordinates[i].length; j++) {
                    coordArray.add('coords', inputGeom.coordinates[i][j] * 1e6);
                }
            }
            geometry.add('coord_array', coordArray);
        } else if (inputGeom.type === 'Polygon' ||
                  inputGeom.type === 'MultiLineString') {
            for (i = 0; i < inputGeom.coordinates.length; i++) {
                coordArray = new CoordArray();
                for (j = 0; j < inputGeom.coordinates[i].length; j++) {
                    for (k = 0; k < inputGeom.coordinates[i][j].length; k++) {
                        coordArray.add('coords', inputGeom.coordinates[i][j][k] * 1e6);
                    }
                }
                geometry.add('coord_array', coordArray);
            }
        } else if (inputGeom.type === 'MultiPolygon') {
            for (i = 0; i < inputGeom.coordinates.length; i++) {
                multiArray = new MultiArray();
                for (j = 0; j < inputGeom.coordinates[i].length; j++) {
                    coordArray = new CoordArray();
                    for (k = 0; k < inputGeom.coordinates[i][j].length; k++) {
                        for (l = 0; l < inputGeom.coordinates[i][j][k].length; l++) {
                            coordArray.add('coords', inputGeom.coordinates[i][j][k][l] * 1e6);
                        }
                    }
                    multiArray.add('arrays', coordArray);
                }
                geometry.add('multi_array', multiArray);
            }
        }
        feature.add('geometries', geometry);
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

    var geojsonGeometries = [];
    var geometryTypes = _.invert(b.build('geometry.Type'));

    for (var j = 0; j < feature.geometries.length; j++) {
        geojsonGeometries.push(parseGeometry(feature.geometries[j]));
    }

    if (geojsonGeometries.length === 1) {
        geojson.geometry = geojsonGeometries[0];
    } else {
        geojson.geometry = {
            type: 'GeometryCollection',
            geometries: geojsonGeometries
        };
    }

    function parseGeometry(inputGeom) {
        var outputGeom = {
            coordinates: []
        };
        var i, j, l;
        var arr = inputGeom.coord_array[0];
        outputGeom.type = geotypeMap[geometryTypes[inputGeom.type]];
        if (outputGeom.type === 'Point') {
            for (i = 0; i < arr.coords.length; i++) {
                outputGeom.coordinates.push(arr.coords[i].toNumber() / 1e6);
            }
        } else if (outputGeom.type === 'LineString' ||
            outputGeom.type === 'MultiPoint') {
            var coord = [];
            for (i = 0; i < arr.coords.length; i++) {
                coord.push(arr.coords[i].toNumber() / 1e6);
                if (coord.length === 2) {
                    outputGeom.coordinates.push(coord);
                    coord = [];
                }
            }
        } else if (outputGeom.type === 'Polygon' ||
            outputGeom.type === 'MultiLineString') {
            var coord = [], ca = [];
            for (i = 0; i < inputGeom.coord_array.length; i++) {
                ca = [];
                for (j = 0; j < inputGeom.coord_array[i].coords.length; j++) {
                    coord.push(inputGeom.coord_array[i].coords[j].toNumber() / 1e6);
                    if (coord.length === 2) {
                        ca.push(coord);
                        coord = [];
                    }
                }
                outputGeom.coordinates.push(ca);
            }
        } else if (outputGeom.type === 'MultiPolygon') {
            var coord = [], ca = [], i, j, k;
            for (i = 0; i < inputGeom.multi_array.length; i++) {
                mca = [];
                for (j = 0; j < inputGeom.multi_array[i].arrays.length; j++) {
                    ca = [];
                    for (k = 0; k < inputGeom.multi_array[i].arrays[j].coords.length; k++) {
                        coord.push(inputGeom.multi_array[i].arrays[j].coords[k].toNumber() / 1e6);
                        if (coord.length === 2) {
                            ca.push(coord);
                            coord = [];
                        }
                    }
                    mca.push(ca);
                }
                outputGeom.coordinates.push(mca);
            }
        }

        return outputGeom;
    }

    return geojson;
}

function truthy(val) {
    return val !== null;
}
