var ProtoBuf = require('protobufjs'),
    assert = require('assert'),
    _ = require('underscore'),
    fs = require('fs');

module.exports.featureToGeobuf = featureToGeobuf;
module.exports.featureCollectionToGeobuf = featureCollectionToGeobuf;
module.exports.geobufToFeature = geobufToFeature;
module.exports.geobufToFeatureCollection = geobufToFeatureCollection;

var Builder = ProtoBuf.loadProtoFile(__dirname + '/geobuf.proto');
var geometryTypes = _.invert(Builder.build('geometry.Type'));
var CoordArray = Builder.build('coord_array');
var MultiArray = Builder.build('multi_array');
var Property = Builder.build('property');
var Value = Builder.build('value');
var FeatureCollection = Builder.build('featurecollection');
var Feature = Builder.build('feature');
var Geometry = Builder.build('geometry');
var GeometryType = Builder.build('geometry.Type');
var Id = Builder.build('id');

var geotypeMap = {
    POINT: 'Point',
    MULTIPOINT: 'MultiPoint',
    LINESTRING: 'LineString',
    MULTILINESTRING: 'MultiLineString',
    POLYGON: 'Polygon',
    MULTIPOLYGON: 'MultiPolygon',
};

var geotypeMapRev = _.invert(geotypeMap);

function featureCollectionToGeobuf(geojson) {
    assert.equal(geojson.type, 'FeatureCollection');

    var b = Builder;
    var featurecollection = new FeatureCollection();

    for (var i = 0; i < geojson.features.length; i++) {
        featurecollection.add('features', _featureToGeobuf(geojson.features[i]));
    }

    return featurecollection;
}

function featureToGeobuf(geojson) {
    assert.equal(geojson.type, 'Feature');
    return featureCollectionToGeobuf({
        type: 'FeatureCollection',
        features: [geojson]
    });
}

function is_xyz(coords) {
    for(var i =0; i < coords.length; i++) {
        if (coords[i].length > 2) return true;
    }
    return false;
}

function _featureToGeobuf(geojson) {

    assert.equal(geojson.type, 'Feature');
    assert.equal(typeof geojson.geometry, 'object');

    var b = Builder;
    var feature = new Feature();

    addGeometry(geojson.geometry);

    function addGeometry(inputGeom) {
        if (inputGeom.type === 'GeometryCollection') {
            for (var k = 0; k < inputGeom.geometries.length; k++) {
                addGeometry(inputGeom.geometries[k]);
            }
            return;
        }
        var geometry = new Geometry();
        var geometryTypes = GeometryType;
        if (geometryTypes[geotypeMapRev[inputGeom.type]] === undefined) {
            assert.fail('geometry type unknown', inputGeom.type);
        }
        geometry.type = geometryTypes[geotypeMapRev[inputGeom.type]];

        var i, j, l, k, coordArray, xzy;
        if (inputGeom.type === 'Point') {
            coordArray = new CoordArray();
            coordArray.set('is_xyz', (inputGeom.coordinates.length === 3));
            for (i = 0; i < inputGeom.coordinates.length; i++) {
                coordArray.add('coords', inputGeom.coordinates[i] * 1e6);
            }
            geometry.add('coord_array', coordArray);
        } else if (inputGeom.type === 'LineString' ||
                inputGeom.type === 'MultiPoint') {
            coordArray = new CoordArray();
            xyz = is_xyz(inputGeom.coordinates);
            coordArray.set('is_xyz', xyz);
            for (i = 0; i < inputGeom.coordinates.length; i++) {
                if (xyz && inputGeom.coordinates[i].length == 2) inputGeom.coordinates[i].push(0);
                for (j = 0; j < inputGeom.coordinates[i].length; j++) {
                    coordArray.add('coords', inputGeom.coordinates[i][j] * 1e6);
                }
            }
            geometry.add('coord_array', coordArray);
        } else if (inputGeom.type === 'Polygon' ||
                  inputGeom.type === 'MultiLineString') {
            for (i = 0; i < inputGeom.coordinates.length; i++) {
                coordArray = new CoordArray();
                xyz = is_xyz(inputGeom.coordinates[i]);
                coordArray.set('is_xyz', xyz);
                for (j = 0; j < inputGeom.coordinates[i].length; j++) {
                    if (xyz && inputGeom.coordinates[i][j].length == 2) inputGeom.coordinates[i][j].push(0);
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
                    xyz = is_xyz(inputGeom.coordinates[i][j]);
                    coordArray.set('is_xyz', xyz);
                    for (k = 0; k < inputGeom.coordinates[i][j].length; k++) {
                        if (xyz && (inputGeom.coordinates[i][j][k].length === 2)) inputGeom.coordinates[i][j][k].push(0);
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

    for (var k in geojson.properties) {
        var p = new Property(),
            val = new Value(),
            v = geojson.properties[k];

        p.set('key', k);
        switch (typeof v) {
            case 'number':
                val.set('double_value',  v);
                break;
            case 'boolean':
                val.set('bool_value',  v);
                break;
            case 'string':
                val.set('string_value',  v.toString());
                break;
            case 'object':
                val.set('string_value', JSON.stringify(v))
                p.set('object', true);
                break;
        }

        p.set('value', val);
        feature.add('properties', p);
    }

    if (geojson.id) {
        var id = new Id();
        id.set('value', geojson.id.toString());
        feature.set('id', id);
    }

    return feature;
}

function geobufToFeature(buf) {
    return geobufToFeatureCollection(buf).features[0];
}

function geobufToFeatureCollection(buf) {
    var b = Builder;
    var featurecollection = FeatureCollection.decode(buf);
    var geojson = {
        type: 'FeatureCollection',
        features: []
    };

    for (var i = 0; i < featurecollection.features.length; i++) {
        geojson.features.push(_geobufToFeature(featurecollection.features[i], b));
    }

    return geojson;
}

function _geobufToFeature(feature, b) {

    var geojson = {
        type: 'Feature',
        properties: {},
        geometry: {}
    };

    if (feature.id) { geojson.id = feature.id.value; }

    for (var i = 0; i < feature.properties.length; i++) {
        // inefficient!
        var value = _.find(_.values(feature.properties[i].value), truthy);

        if (feature.properties[i].object) {
            value = JSON.parse(value);
        }
        geojson.properties[feature.properties[i].key] = value;
    }

    var geojsonGeometries = [];

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
                if (!arr.is_xyz && coord.length === 2) {
                    outputGeom.coordinates.push(coord);
                    coord = [];
                } else if (arr.is_xyz && coord.length === 3) {
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
                    if (!inputGeom.coord_array[i].is_xyz && coord.length === 2) {
                        ca.push(coord);
                        coord = [];
                    } else if (inputGeom.coord_array[i].is_xyz && coord.length === 3) {
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
                        if (!inputGeom.multi_array[i].arrays[j].is_xyz && coord.length === 2) {
                            ca.push(coord);
                            coord = [];
                        } else if (inputGeom.multi_array[i].arrays[j].is_xyz && coord.length === 3) {
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
