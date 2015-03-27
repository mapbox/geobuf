'use strict';

module.exports = encode;

var keys, keysNum, dim, e, isTopo, transformed,
    maxPrecision = 1e6;

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
    transformed = false;
    isTopo = false;

    analyze(obj);

    e = Math.min(e, maxPrecision);
    var precision = Math.ceil(Math.log(e) / Math.LN10);

    var keysArr = Object.keys(keys);

    for (var i = 0; i < keysArr.length; i++) pbf.writeStringField(1, keysArr[i]);
    if (dim !== 2) pbf.writeVarintField(2, dim);
    if (precision !== 6) pbf.writeVarintField(3, precision);

    if (obj.type === 'FeatureCollection') pbf.writeMessage(4, writeFeatureCollection, obj);
    else if (obj.type === 'Feature') pbf.writeMessage(5, writeFeature, obj);
    else if (obj.type === 'Topology') pbf.writeMessage(7, writeTopology, obj);
    else pbf.writeMessage(6, writeGeometry, obj);

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
        isTopo = true;

        for (key in obj) {
            if (key !== 'type' && key !== 'transform' && key !== 'arcs' && key !== 'objects') saveKey(key);
        }
        analyzeMultiLine(obj.arcs);

        for (key in obj.objects) {
            analyze(obj.objects[key]);
        }

    } else {
        if (obj.type === 'Point') analyzePoint(obj.coordinates);
        else if (obj.type === 'MultiPoint') analyzePoints(obj.coordinates);
        else if (obj.type === 'GeometryCollection') {
            for (i = 0; i < obj.geometries.length; i++) analyze(obj.geometries[i]);
        }
        else if (!isTopo) {
            if (obj.type === 'LineString') analyzePoints(obj.coordinates);
            else if (obj.type === 'Polygon' || obj.type === 'MultiLineString') analyzeMultiLine(obj.coordinates);
            else if (obj.type === 'MultiPolygon') {
                for (i = 0; i < obj.coordinates.length; i++) analyzeMultiLine(obj.coordinates[i]);
            }
        }

        for (key in obj.properties) saveKey(key);
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

function writeFeatureCollection(obj, pbf) {
    for (var i = 0; i < obj.features.length; i++) {
        pbf.writeMessage(1, writeFeature, obj.features[i]);
    }
    writeProps(obj, pbf, true);
}

function writeFeature(feature, pbf) {
    pbf.writeMessage(1, writeGeometry, feature.geometry);

    if (feature.id !== undefined) {
        if (typeof feature.id === 'number' && feature.id % 1 === 0) pbf.writeSVarintField(12, feature.id);
        else pbf.writeStringField(11, feature.id);
    }

    if (feature.properties) writeProps(feature.properties, pbf);
    writeProps(feature, pbf, true);
}

function writeGeometry(geom, pbf) {
    pbf.writeVarintField(1, geometryTypes[geom.type]);

    var coords = geom.coordinates,
        coordsOrArcs = isTopo ? geom.arcs : coords;

    if (geom.type === 'Point') writePoint(coords, pbf);
    else if (geom.type === 'MultiPoint') writeLine(coords, pbf, true);
    else if (geom.type === 'LineString') writeLine(coordsOrArcs, pbf);
    if (geom.type === 'MultiLineString' || geom.type === 'Polygon') writeMultiLine(coordsOrArcs, pbf);
    else if (geom.type === 'MultiPolygon') writeMultiPolygon(coordsOrArcs, pbf);
    else if (geom.type === 'GeometryCollection') {
        for (var i = 0; i < geom.geometries.length; i++) pbf.writeMessage(4, writeGeometry, geom.geometries[i]);
    }

    if (isTopo && geom.id !== undefined) {
        if (typeof geom.id === 'number' && geom.id % 1 === 0) pbf.writeSVarintField(12, geom.id);
        else pbf.writeStringField(11, geom.id);
    }

    if (isTopo && geom.properties) writeProps(geom.properties, pbf);
    writeProps(geom, pbf, true);
}

function writeTopology(topology, pbf) {
    if (topology.transform) {
        pbf.writeMessage(1, writeTransform, topology.transform);
        transformed = true;
    }

    var names = Object.keys(topology.objects),
        i, j, d;

    for (i = 0; i < names.length; i++) pbf.writeStringField(2, names[i]);
    for (i = 0; i < names.length; i++) {
        pbf.writeMessage(3, writeGeometry, topology.objects[names[i]]);
    }

    var lengths = [],
        coords = [];

    for (i = 0; i < topology.arcs.length; i++) {
        var arc = topology.arcs[i];
        lengths.push(arc.length);

        for (j = 0; j < arc.length; j++) {
            for (d = 0; d < dim; d++) coords.push(transformCoord(arc[j][d]));
        }
    }

    pbf.writePackedVarint(4, lengths);
    pbf.writePackedSVarint(5, coords);

    writeProps(topology, pbf, true);
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
            } else if (props.type === 'Topology') {
                if (key === 'transform' || key === 'arcs' || key === 'objects') continue;
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
    for (var i = 0; i < dim; i++) coords.push(transformCoord(point[i]));
    pbf.writePackedSVarint(3, coords);
}

function writeLine(line, pbf, isMultiPoint) {
    var coords = [];
    populateLine(coords, line, isMultiPoint);
    pbf.writePackedSVarint(3, coords);
}

function writeMultiLine(lines, pbf) {
    var len = lines.length,
        i;
    if (len !== 1) {
        var lengths = [];
        for (i = 0; i < len; i++) lengths.push(lines[i].length);
        pbf.writePackedVarint(2, lengths);
        // TODO faster with custom writeMessage?
    }
    var coords = [];
    for (i = 0; i < len; i++) populateLine(coords, lines[i]);
    pbf.writePackedSVarint(3, coords);
}

function writeMultiPolygon(polygons, pbf) {
    var len = polygons.length,
        i, j;
    if (len !== 1 || polygons[0].length !== 1 || polygons[0][0].length !== 1) {
        var lengths = [len];
        for (i = 0; i < len; i++) {
            lengths.push(polygons[i].length);
            for (j = 0; j < polygons[i].length; j++) lengths.push(polygons[i][j].length);
        }
        pbf.writePackedVarint(2, lengths);
    }

    var coords = [];
    for (i = 0; i < len; i++) {
        for (j = 0; j < polygons[i].length; j++) populateLine(coords, polygons[i][j]);
    }
    pbf.writePackedSVarint(3, coords);
}

function populateLine(coords, line, isMultiPoint) {
    var i, j;
    for (i = 0; i < line.length; i++) {
        if (isTopo && !isMultiPoint) coords.push(i ? line[i] - line[i - 1] : line[i]);
        else for (j = 0; j < dim; j++) coords.push(transformCoord(line[i][j] - (i ? line[i - 1][j] : 0)));
    }
}

function transformCoord(x) {
    return transformed ? x : Math.round(x * e);
}

function writeTransform(tr, pbf) {
    pbf.writeDoubleField(1, tr.scale[0]);
    pbf.writeDoubleField(2, tr.scale[1]);
    pbf.writeDoubleField(3, tr.translate[0]);
    pbf.writeDoubleField(4, tr.translate[1]);
}
