var protobuf = require('protocol-buffers'),
    assert = require('assert'),
    _ = require('underscore'),
    fs = require('fs');

module.exports.featureToGeobuf = featureToGeobuf;
module.exports.featureCollectionToGeobuf = featureCollectionToGeobuf;
module.exports.geobufToFeature = geobufToFeature;
module.exports.geobufToFeatureCollection = geobufToFeatureCollection;

var Builder = protobuf(fs.readFileSync(__dirname + '/geobuf.proto'));
var geobufJSON = Builder.toJSON();
var structure = {};
for (var i=0; i<geobufJSON.messages.length; i++){
    structure[geobufJSON.messages[i].id] = geobufJSON.messages[i];
}

function _getEnumByID(enums, id){
    return _.find(enums, function(e){return e.id == id});
}

var GeometryType = _getEnumByID(structure.geometry.enums, 'geometry.Type').values;
var geometryTypes = _.invert(GeometryType);
var propertyValueType = _getEnumByID(structure.value.enums, 'value.Type').values;
var propertyValueTypeRev = _.invert(propertyValueType);

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

    var featurecollection = {
        features: []
    };
    
    for (var i = 0; i < geojson.features.length; i++) {
        featurecollection.features.push(_featureToGeobuf(geojson.features[i]));
    }
    return Builder.featurecollection.encode(featurecollection);
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

function _coordsToCoordArray(coords){
    var i,j,
        xyz = is_xyz(coords);
    var coordArray = {
        coords: [],
        is_xyz: xyz
    };
    for (i = 0; i < coords.length; i++) {
        if (xyz && coords[i].length == 2) coords[i].push(0);
        for (j = 0; j < coords[i].length; j++) {
            coordArray.coords.push(coords[i][j] * 1e6);
        }
    }
    return coordArray;
}

function _featureToGeobuf(geojson) {

    assert.equal(geojson.type, 'Feature');
    assert.equal(typeof geojson.geometry, 'object');

    var feature = {
        geometries: [],
        properties: []
    };

    addGeometry(geojson.geometry);

    function addGeometry(inputGeom) {
        var i, j, l, k, coordArray, xzy;

        if (inputGeom.type === 'GeometryCollection') {
            for (k = 0; k < inputGeom.geometries.length; k++) {
                addGeometry(inputGeom.geometries[k]);
            }
            return;
        }
        var geometryTypes = GeometryType;
        if (geometryTypes[geotypeMapRev[inputGeom.type]] === undefined) {
            assert.fail('geometry type unknown', inputGeom.type);
        }

        var geometry = {
            type: geometryTypes[geotypeMapRev[inputGeom.type]],
            coord_array: [],
            multi_array: []
        };

        if (inputGeom.type === 'Point') {
            coordArray = {
                coords: [],
                is_xyz: (inputGeom.coordinates.length === 3)
            };
            for (i = 0; i < inputGeom.coordinates.length; i++) {
                coordArray.coords.push(inputGeom.coordinates[i] * 1e6);
            }
            geometry.coord_array.push(coordArray);
        } else if (inputGeom.type === 'LineString' ||
                inputGeom.type === 'MultiPoint') {
            geometry.coord_array.push(_coordsToCoordArray(inputGeom.coordinates));
        } else if (inputGeom.type === 'Polygon' ||
                  inputGeom.type === 'MultiLineString') {
            for (i = 0; i < inputGeom.coordinates.length; i++) {
                geometry.coord_array.push(_coordsToCoordArray(inputGeom.coordinates[i]));
            }
        } else if (inputGeom.type === 'MultiPolygon') {
            var multiArray;
            for (i = 0; i < inputGeom.coordinates.length; i++) {
                multiArray = {
                    arrays: []
                };
                for (j = 0; j < inputGeom.coordinates[i].length; j++) {
                    multiArray.arrays.push(_coordsToCoordArray(inputGeom.coordinates[i][j]));
                }
                geometry.multi_array.push(multiArray);
            }
        }
        
        feature.geometries.push(geometry);
    }

    for (var k in geojson.properties) {
        var property = {key: k, value: {}},
            v = geojson.properties[k],
            value, valueType;

        switch (typeof v) {
            case 'number': 
                value = v;
                if (v|0 === v){
                    if (v > 0) {
                        valueType = 'uint_value';
                    }
                    else {
                        valueType = 'sint_value';
                    }
                }
                else {
                    valueType = 'float_value';
                }
                break;
            case 'boolean':
                value = v;
                valueType = 'bool_value';
                break;
            case 'string':
                value = v.toString();
                valueType = 'string_value';
                break;
        }
        property.value[valueType] = value;
        property.value.type = propertyValueType[valueType];
        feature.properties.push(property);
    }

    if (geojson.id) {
        feature.id = {value: geojson.id};
    }

    return feature;
}

function geobufToFeature(buf) {
    return geobufToFeatureCollection(buf).features[0];
}

function geobufToFeatureCollection(buf) {
    var featurecollection = Builder.featurecollection.decode(buf);
    var geojson = {
        type: 'FeatureCollection',
        features: []
    };

    for (var i = 0; i < featurecollection.features.length; i++) {
        geojson.features.push(_geobufToFeature(featurecollection.features[i]));
    }

    return geojson;
}

function _coordArrayToCoords(coordArray, is_xyz){
    var coords = [],
        coord = [];
    for (i = 0; i < coordArray.length; i++) {
        coord.push(coordArray[i] / 1e6);
        if (!is_xyz && coord.length === 2) {
            coords.push(coord);
            coord = [];
        } else if (is_xyz && coord.length === 3) {
            coords.push(coord);
            coord = [];
        }
    }
    return coords;
}

function _geobufToFeature(feature) {

    var geojson = {
        type: 'Feature',
        properties: {},
        geometry: {}
    };

    if (feature.id) { geojson.id = feature.id.value; }

    for (var i = 0; i < feature.properties.length; i++) {
        var valueType = propertyValueTypeRev[feature.properties[i].value.type];
        geojson.properties[feature.properties[i].key] = feature.properties[i].value[valueType];
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
                outputGeom.coordinates.push(arr.coords[i] / 1e6);
            }
        } else if (outputGeom.type === 'LineString' ||
            outputGeom.type === 'MultiPoint') {
            outputGeom.coordinates = _coordArrayToCoords(arr.coords, arr.is_xyz);
        } else if (outputGeom.type === 'Polygon' ||
            outputGeom.type === 'MultiLineString') {
            for (i = 0; i < inputGeom.coord_array.length; i++) {
                arr = inputGeom.coord_array[i];
                outputGeom.coordinates.push(_coordArrayToCoords(arr.coords, arr.is_xyz));
            }
        } else if (outputGeom.type === 'MultiPolygon') {
            // var coord = [], ca = [], i, j, k;
            for (i = 0; i < inputGeom.multi_array.length; i++) {
                mca = [];
                for (j = 0; j < inputGeom.multi_array[i].arrays.length; j++) {
                    arr = inputGeom.multi_array[i].arrays[j];
                    mca.push(_coordArrayToCoords(arr.coords, arr.is_xyz));
                }
                outputGeom.coordinates.push(mca);
            }
        }

        return outputGeom;
    }

    return geojson;
}