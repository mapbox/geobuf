'use strict';

module.exports = encode;

function encode(obj, pbf) {
    var stats = {keys: {}, keysNum: 0, dim: 0, e: 1};
    analyze(obj, stats);
    stats.precision = Math.min(Math.ceil(Math.log(stats.e) / Math.LN10), 6);
    console.log(stats);
}

function analyze(obj, stats) {
    var i, key;

    if (obj.type === 'FeatureCollection') {
        for (i = 0; i < obj.features.length; i++) analyze(obj.features[i], stats);
        for (key in obj) if (key !== 'type' && key !== 'features') saveKey(key, stats);

    } else if (obj.type === 'Feature') {
        analyze(obj.geometry, stats);
        for (key in obj.properties) saveKey(key, stats);
        for (key in obj) {
            if (key !== 'type' && key !== 'id' && key !== 'properties' && key !== 'geometry') saveKey(key, stats);
        }

    } else if (obj.type === 'Topology') {
        // TODO analyze
        for (key in obj) {
            if (key !== 'type' && key !== 'transform' && key !== 'arcs' && key !== 'objects') saveKey(key, stats);
        }

    } else {
        if (obj.type === 'Point') analyzePoint(obj.coordinates, stats);
        else if (obj.type === 'MultiPoint' || obj.type === 'LineString') analyzePoints(obj.coordinates, stats);
        else if (obj.type === 'Polygon' || obj.type === 'MultiLineString') analyzeMultiLine(obj.coordinates, stats);
        else if (obj.type === 'MultiPolygon') {
            for (i = 0; i < obj.coordinates.length; i++) analyzeMultiLine(obj.coordinates[i], stats);

        } else if (obj.type === 'GeometryCollection') {
            for (i = 0; i < obj.geometries.length; i++) analyze(obj.geometries[i], stats);
        }

        for (key in obj.properties) saveKey(key, stats);
        for (key in obj) {
            if (key !== 'type' && key !== 'id' && key !== 'coordinates' && key !== 'arcs' &&
                key !== 'geometries' && key !== 'properties') saveKey(key, stats);
        }
    }
    // TODO analyze TopoJSON dimensions
    // TODO analyze TopoJSON precision
}

function analyzeMultiLine(coords, stats) {
    for (var i = 0; i < coords.length; i++) analyzePoints(coords[i], stats);
}

function analyzePoints(coords, stats) {
    for (var i = 0; i < coords.length; i++) analyzePoint(coords[i], stats);
}

function analyzePoint(point, stats) {
    stats.dim = Math.max(stats.dim, point.length);
    var e = stats.e;
    for (var i = 0; i < point.length; i++) {
        while (Math.round(point[i] * e) / e !== point[i]) e *= 10;
    }
    stats.e = e;
}

function saveKey(key, stats) {
    if (stats.keys[key] === undefined) stats.keys[key] = stats.keysNum++;
}
