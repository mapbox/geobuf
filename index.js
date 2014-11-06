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
var CoordArrayXYZ = Builder.build('coord_array_xyz');
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

function coordArrayType(coordinates) {
    if (coordinates && coordinates.length === 3) {
        return new CoordArrayXYZ();
    }
    return new CoordArray();
}
function coordArrayAttribute(coordArray) {
    return (coordArray instanceof CoordArray) ? 'coord_array' : 'coord_array_xyz';
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

        var i, j, l, k, coordArray, multiArray, coordArrayAttr;
        if (inputGeom.type === 'Point') {
            coordArray = coordArrayType(inputGeom.coordinates);
            for (i = 0; i < inputGeom.coordinates.length; i++) {
                coordArray.add('coords', inputGeom.coordinates[i] * 1e6);
            }
            geometry.add(coordArrayAttribute(coordArray), coordArray);
        } else if (inputGeom.type === 'LineString' ||
                inputGeom.type === 'MultiPoint') {
            coordArray = coordArrayType(inputGeom.coordinates[0]);
            coordArrayAttr = coordArrayAttribute(coordArray);
            for (i = 0; i < inputGeom.coordinates.length; i++) {
                if (coordArrayAttr === 'coord_array_xyz' && inputGeom.coordinates[i].length == 2) inputGeom.coordinates[i].push(0);
                for (j = 0; j < inputGeom.coordinates[i].length; j++) {
                    coordArray.add('coords', inputGeom.coordinates[i][j] * 1e6);
                }
            }
            geometry.add(coordArrayAttr, coordArray);
        } else if (inputGeom.type === 'Polygon' ||
                  inputGeom.type === 'MultiLineString') {
            for (i = 0; i < inputGeom.coordinates.length; i++) {
                coordArray = coordArrayType(inputGeom.coordinates[0][0]);
                coordArrayAttr = coordArrayAttribute(coordArray);
                for (j = 0; j < inputGeom.coordinates[i].length; j++) {
                    if (coordArrayAttr === 'coord_array_xyz' && inputGeom.coordinates[i][j].length == 2) inputGeom.coordinates[i][j].push(0);
                    for (k = 0; k < inputGeom.coordinates[i][j].length; k++) {
                        coordArray.add('coords', inputGeom.coordinates[i][j][k] * 1e6);
                    }
                }
                geometry.add(coordArrayAttr, coordArray);
            }
        } else if (inputGeom.type === 'MultiPolygon') {
            for (i = 0; i < inputGeom.coordinates.length; i++) {
                multiArray = new MultiArray();
                for (j = 0; j < inputGeom.coordinates[i].length; j++) {
                    coordArray = coordArrayType(inputGeom.coordinates[0][0][0]);
                    for (k = 0; k < inputGeom.coordinates[i][j].length; k++) {
                        if ((coordArray instanceof CoordArrayXYZ ) && (inputGeom.coordinates[i][j][k].length === 2)) inputGeom.coordinates[i][j][k].push(0);
                        for (l = 0; l < inputGeom.coordinates[i][j][k].length; l++) {
                            coordArray.add('coords', inputGeom.coordinates[i][j][k][l] * 1e6);
                        }
                    }
                    if (coordArray instanceof CoordArrayXYZ) {
                        multiArray.add('arrays_xyz', coordArray);
                    } else {
                        multiArray.add('arrays', coordArray);
                    }
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
                val.set('float_value',  v);
                break;
            case 'boolean':
                val.set('bool_value',  v);
                break;
            case 'string':
                val.set('string_value',  v.toString());
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
        geojson.properties[feature.properties[i].key] = _.find(
            _.values(feature.properties[i].value), truthy);
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

        // for backward compatiblity
        inputGeom.coord_array_xyz = inputGeom.coord_array_xyz || [];

        var coordType = inputGeom.coord_array_xyz.length > 0 ? 'coord_array_xyz' : 'coord_array';
        var arr = inputGeom[coordType][0] || inputGeom[coordType][0];
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
                if (coordType === 'coord_array' && coord.length === 2) {
                    outputGeom.coordinates.push(coord);
                    coord = [];
                } else if (coordType === 'coord_array_xyz' && coord.length === 3) {
                    outputGeom.coordinates.push(coord);
                    coord = [];
                }
            }
        } else if (outputGeom.type === 'Polygon' ||
            outputGeom.type === 'MultiLineString') {
            var coord = [], ca = [];
            for (i = 0; i < inputGeom[coordType].length; i++) {
                ca = [];
                for (j = 0; j < inputGeom[coordType][i].coords.length; j++) {
                    coord.push(inputGeom[coordType][i].coords[j].toNumber() / 1e6);
                    if (coordType === 'coord_array' && coord.length === 2) {
                        ca.push(coord);
                        coord = [];
                    } else if (coordType === 'coord_array_xyz' && coord.length === 3) {
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

                // for backward compatiblity
                inputGeom.multi_array[i].arrays_xyz = inputGeom.multi_array[i].arrays_xyz || [];
                var maCoordType = inputGeom.multi_array[i].arrays_xyz.length > 0 ? 'arrays_xyz' : 'arrays';
                for (j = 0; j < inputGeom.multi_array[i][maCoordType].length; j++) {
                    ca = [];
                    for (k = 0; k < inputGeom.multi_array[i][maCoordType][j].coords.length; k++) {
                        coord.push(inputGeom.multi_array[i][maCoordType][j].coords[k].toNumber() / 1e6);
                        if (maCoordType === 'arrays' && coord.length === 2) {
                            ca.push(coord);
                            coord = [];
                        } else if (maCoordType === 'arrays_xyz' && coord.length === 3) {
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
