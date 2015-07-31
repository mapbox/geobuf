'use strict';

module.exports = encode;

var keys, keysNum, dim, e,
    maxPrecision = 1e6;

var objTypes = {
    'Point': 0,
    'MultiPoint': 1,
    'LineString': 2,
    'MultiLineString': 3,
    'Polygon': 4,
    'MultiPolygon': 5,
    'GeometryCollection': 6,
    'Geometry': 7,
    'Feature': 8,
    'FeatureCollection': 9
};

function encode(obj, pbf) {
    keys = {};
    keysNum = 0;
    dim = 0;
    e = 1;

    analyze(obj);
    e = Math.min(e, maxPrecision);

    pbf.writeRawMessage(writeHeader);
    writeObjects(obj, pbf);

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

    } else {
        if (obj.type === 'Point') analyzePoint(obj.coordinates);
        else if (obj.type === 'MultiPoint') analyzePoints(obj.coordinates);
        else if (obj.type === 'GeometryCollection') {
            for (i = 0; i < obj.geometries.length; i++) analyze(obj.geometries[i]);
        }
        else if (obj.type === 'LineString') analyzePoints(obj.coordinates);
        else if (obj.type === 'Polygon' || obj.type === 'MultiLineString') analyzeMultiLine(obj.coordinates);
        else if (obj.type === 'MultiPolygon') {
            for (i = 0; i < obj.coordinates.length; i++) analyzeMultiLine(obj.coordinates[i]);
        }

        for (key in obj) {
            if (key !== 'type' && key !== 'id' && key !== 'coordinates' && key !== 'arcs' &&
                key !== 'geometries' && key !== 'properties') saveKey(key);
        }
    }
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
        while (Math.round(point[i] * e) / e !== point[i] && e < maxPrecision) e *= 10;
    }
}

function saveKey(key) {
    if (keys[key] === undefined) keys[key] = keysNum++;
}

function writeHeader(obj, pbf) {
    var precision = Math.ceil(Math.log(e) / Math.LN10);

    for (var id in keys) pbf.writeStringField(1, id);
    if (dim !== 2) pbf.writeVarintField(2, dim);
    if (precision !== 6) pbf.writeVarintField(3, precision);
}

function writeObjects(obj, pbf) {
    pbf.writeRawMessage(writeObject, obj);

    var i;

    if (obj.type === 'FeatureCollection') {
        for (i = 0; i < obj.features.length; i++) writeObjects(obj.features[i], pbf);

    } else if (obj.type === 'Feature') {
        if (obj.geometry) writeObjects(obj.geometry, pbf);

    } else if (obj.type === 'GeometryCollection' && obj.geometries) {
        for (i = 0; i < obj.geometries.length; i++) writeObjects(obj.geometries[i], pbf);
    }
}

function writeObject(obj, pbf) {
    pbf.writeVarintField(1, objTypes[obj.type]);

    var coords = obj.coordinates;

    if (obj.type === 'Point') writePoint(coords, pbf);
    else if (obj.type === 'MultiPoint') writeLine(coords, pbf, true);
    else if (obj.type === 'LineString') writeLine(coords, pbf);
    else if (obj.type === 'MultiLineString') writeMultiLine(coords, pbf);
    else if (obj.type === 'Polygon') writeMultiLine(coords, pbf, true);
    else if (obj.type === 'MultiPolygon') writeMultiPolygon(coords, pbf);

    if (obj.id !== undefined) {
        if (typeof obj.id === 'number' && obj.id % 1 === 0) pbf.writeSVarintField(12, obj.id);
        else pbf.writeStringField(11, obj.id);
    }

    if (obj.properties) writeProps(obj.properties, pbf);
    writeProps(obj, pbf, true);
}

function writeProps(props, pbf, isCustom) {
    var indexes = [],
        valueIndex = 0;

    for (var key in props) {
        if (isCustom) {
            if (key === 'type' || key === 'id' || key === 'coordinates' || key === 'arcs' ||
                key === 'geometries' || key === 'properties') continue;
            else if (props.type === 'FeatureCollection') {
                if (key === 'features') continue;
            } else if (props.type === 'Feature') {
                if (key === 'id' || key === 'properties' || key === 'geometry') continue;
            }
        }
        pbf.writeMessage(13, writeValue, props[key]);
        indexes.push(keys[key]);
        indexes.push(valueIndex++);
    }
    pbf.writePackedVarint(isCustom ? 15 : 14, indexes);
}

function writeValue(value, pbf) {
    var type = typeof value;

    if (type === 'string') pbf.writeStringField(1, value);
    else if (type === 'boolean') pbf.writeBooleanField(5, value);
    else if (type === 'object') pbf.writeStringField(6, JSON.stringify(value));
    else if (type === 'number') {
        if (value % 1 !== 0) pbf.writeDoubleField(2, value);
        else if (value >= 0) pbf.writeVarintField(3, value);
        else pbf.writeVarintField(4, -value);
    }
}

function writePoint(point, pbf) {
    var coords = [];
    for (var i = 0; i < dim; i++) coords.push(Math.round(point[i] * e));
    pbf.writePackedSVarint(3, coords);
}

function writeLine(line, pbf) {
    var coords = [];
    populateLine(coords, line);
    pbf.writePackedSVarint(3, coords);
}

function writeMultiLine(lines, pbf, closed) {
    var len = lines.length,
        i;
    if (len !== 1) {
        var lengths = [];
        for (i = 0; i < len; i++) lengths.push(lines[i].length - (closed ? 1 : 0));
        pbf.writePackedVarint(2, lengths);
        // TODO faster with custom writeMessage?
    }
    var coords = [];
    for (i = 0; i < len; i++) populateLine(coords, lines[i], closed);
    pbf.writePackedSVarint(3, coords);
}

function writeMultiPolygon(polygons, pbf) {
    var len = polygons.length,
        i, j;
    if (len !== 1 || polygons[0].length !== 1) {
        var lengths = [len];
        for (i = 0; i < len; i++) {
            lengths.push(polygons[i].length);
            for (j = 0; j < polygons[i].length; j++) lengths.push(polygons[i][j].length - 1);
        }
        pbf.writePackedVarint(2, lengths);
    }

    var coords = [];
    for (i = 0; i < len; i++) {
        for (j = 0; j < polygons[i].length; j++) populateLine(coords, polygons[i][j], true);
    }
    pbf.writePackedSVarint(3, coords);
}

function populateLine(coords, line, closed) {
    var i, j,
        len = line.length - (closed ? 1 : 0);
    for (i = 0; i < len; i++) {
        for (j = 0; j < dim; j++) coords.push(Math.round((line[i][j] - (i ? line[i - 1][j] : 0)) * e));
    }
}
