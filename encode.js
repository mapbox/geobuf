'use strict';

module.exports = encode;

var keys, keysNum, dim, e;

var geometryTypes = {
    'Point': 0,
    'MultiPoint': 1,
    'LineString': 2,
    'MultiLineString': 3,
    'Polygon': 4,
    'MultiPolygon': 5,
    'GeometryCollection': 6
};

function encode(obj, pbf) {
    keys = {};
    keysNum = 0;
    dim = 0;
    e = 1;

    analyze(obj);

    e = Math.min(e, 1e6);
    var precision = Math.ceil(Math.log(e) / Math.LN10);

    console.log('keys', keys, 'dim', dim, 'precision', precision);

    var keysArr = Object.keys(keys);

    for (var i = 0; i < keysArr.length; i++) pbf.writeString(1, keysArr[i]);
    pbf.writeVarintField(2, dim);
    pbf.writeVarintField(3, precision);

    if (obj.type === 'FeatureCollection') pbf.writeMessage(4, writeFeatureCollection, obj);
    // TODO other stuff

    keys = null;

    return pbf.finish();
}

function analyze(obj) {
    var i, key;

    if (obj.type === 'FeatureCollection') {
        for (i = 0; i < obj.features.length; i++) analyze(obj.features[i]);
        for (key in obj) if (key !== 'type' && key !== 'features') saveKey(key);

    } else if (obj.type === 'Feature') {
        analyze(obj.geometry);
        for (key in obj.properties) saveKey(key);
        for (key in obj) {
            if (key !== 'type' && key !== 'id' && key !== 'properties' && key !== 'geometry') saveKey(key);
        }

    } else if (obj.type === 'Topology') {
        // TODO analyze
        for (key in obj) {
            if (key !== 'type' && key !== 'transform' && key !== 'arcs' && key !== 'objects') saveKey(key);
        }

    } else {
        if (obj.type === 'Point') analyzePoint(obj.coordinates);
        else if (obj.type === 'MultiPoint' || obj.type === 'LineString') analyzePoints(obj.coordinates);
        else if (obj.type === 'Polygon' || obj.type === 'MultiLineString') analyzeMultiLine(obj.coordinates);
        else if (obj.type === 'MultiPolygon') {
            for (i = 0; i < obj.coordinates.length; i++) analyzeMultiLine(obj.coordinates[i]);

        } else if (obj.type === 'GeometryCollection') {
            for (i = 0; i < obj.geometries.length; i++) analyze(obj.geometries[i]);
        }

        for (key in obj.properties) saveKey(key);
        for (key in obj) {
            if (key !== 'type' && key !== 'id' && key !== 'coordinates' && key !== 'arcs' &&
                key !== 'geometries' && key !== 'properties') saveKey(key);
        }
    }
    // TODO analyze TopoJSON dimensions
    // TODO analyze TopoJSON precision
}

function analyzeMultiLine(coords) {
    for (var i = 0; i < coords.length; i++) analyzePoints(coords[i]);
}

function analyzePoints(coords) {
    for (var i = 0; i < coords.length; i++) analyzePoint(coords[i]);
}

function analyzePoint(point) {
    dim = Math.max(dim, point.length);

    // find max precision
    for (var i = 0; i < point.length; i++) {
        while (Math.round(point[i] * e) / e !== point[i]) e *= 10;
    }
}

function saveKey(key) {
    if (keys[key] === undefined) keys[key] = keysNum++;
}

function writeFeatureCollection(obj, pbf) {
    for (var i = 0; i < obj.features.length; i++) {
        pbf.writeMessage(1, writeFeature, obj.features[i]);
    }
    // TODO custom props
}

function writeFeature(feature, pbf) {
    pbf.writeMessage(1, writeGeometry, feature.geometry);
    // TODO id
    // TODO custom props
    var props = [],
        valueIndex = 0;

    for (var key in feature.properties) {
        pbf.writeMessage(13, writeValue, feature.properties[key]);
        props.push(keys[key], valueIndex++);
    }
    pbf.writePackedVarint(15, props);
}

function writeValue(value, pbf) {
    var type = typeof value;

    if (type === 'string') pbf.writeStringField(1, value);
    else if (type === 'boolean') pbf.writeBooleanField(5, value);
    else if (type === 'object') pbf.writeStringField(6, JSON.stringify(value));
    else if (type === 'number') {
       if (value % 1 !== 0) pbf.writeDoubleField(2, value);
       else if (value < 0) pbf.writeSVarintField(3, value);
       else pbf.writeVarintField(4, value);
    }
}

function writeGeometry(geom, pbf) {
    pbf.writeVarintField(1, geometryTypes[geom.type]);

    if (geom.type === 'MultiLineString' || geom.type === 'Polygon') writeMultiLine(geom.coordinates, pbf);
    else if (geom.type === 'MultiPolygon') writeMultiPolygon(geom.coordinates, pbf);

    // TODO other types
    // TODO TopoJSON stuff
    // TODO custom props
}

function writeMultiLine(lines, pbf) {
    var len = lines.length;
    if (len !== 1) {
        var lengths = [];
        for (var i = 0; i < len; i++) lengths.push(lines[i].length);
        pbf.writePackedVarint(2, lengths);
        // TODO faster with custom writeMessage?
    }
    var coords = [];
    for (var i = 0; i < len; i++) populateLine(coords, lines[i]);
    pbf.writePackedSVarint(3, coords);
}

function writeMultiPolygon(polygons, pbf) {
    var len = polygons.length;
    if (len !== 1 || polygons[0].length !== 1 || polygons[0][0].length !== 1) {
        var lengths = [len];
        for (var i = 0; i < len; i++) {
            lengths.push(polygons[i].length);
            for (var j = 0; j < polygons[i].length; j++) lengths.push(polygons[i][j].length);
        }
        pbf.writePackedVarint(2, lengths);
    }

    var coords = [];
    for (var i = 0; i < len; i++) {
        for (var j = 0; j < polygons[i].length; j++) populateLine(coords, polygons[i][j]);
    }
    pbf.writePackedSVarint(3, coords);
}

function populateLine(coords, line) {
    var i, j, p;
    for (i = 0; i < line.length; i++) {
        if (i) for (j = 0; j < dim; j++) coords.push(Math.round((line[i][j] - line[i - 1][j]) * e));
        else for (j = 0; j < dim; j++) coords.push(Math.round(line[i][j] * e));
    }
}


