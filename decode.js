'use strict';

module.exports = decode;

var keys, values, lengths, dim, e;

var objTypes = ['Point', 'MultiPoint', 'LineString', 'MultiLineString',
                      'Polygon', 'MultiPolygon', 'GeometryCollection', 'Feature', 'FeatureCollection'];

function decode(pbf) {
    dim = 2;
    e = Math.pow(10, 6);

    keys = [];
    values = [];

    var lastFeatureCol,
        lastFeature,
        lastGeometryCol;

    var root;

    while (pbf.pos < pbf.length) {
        var obj = pbf.readMessage(readObjectField, {});
        if (!root) root = obj;

        if (obj.type === 'FeatureCollection') {
            obj.features = [];

            lastFeatureCol = obj;

        } else if (obj.type === 'Feature') {
            if (lastFeatureCol) lastFeatureCol.features.push(obj);

            lastGeometryCol = null;
            lastFeature = obj;

        } else {
            if (lastGeometryCol) lastGeometryCol.geometries.push(obj);
            else if (lastFeature) lastFeature.geometry = obj;

            if (obj.type === 'GeometryCollection') {
                obj.geometries = [];

                lastGeometryCol = obj;
            }
        }
    }

    keys = null;
    lengths = null;

    return root;
}

function readObjectField(tag, obj, pbf) {
    if (tag === 1) obj.type = objTypes[pbf.readVarint()];
    else if (tag === 2) dim = pbf.readVarint();
    else if (tag === 3) e = Math.pow(10, pbf.readVarint());
    else if (tag === 4) keys.push(pbf.readString());

    else if (tag === 6) lengths = pbf.readPackedVarint();
    else if (tag === 7) readCoords(obj, pbf, obj.type);

    else if (tag === 8) obj.id = pbf.readString();
    else if (tag === 9) obj.id = pbf.readSVarint();

    else if (tag === 13) values.push(readValue(pbf));
    else if (tag === 14) obj.properties = readProps(pbf, {});
    else if (tag === 15) readProps(pbf, obj);
}

function readCoords(geom, pbf, type) {
    if (type === 'Point') geom.coordinates = readPoint(pbf);
    else if (type === 'MultiPoint') geom.coordinates = readLine(pbf, true);
    else if (type === 'LineString') geom.coordinates = readLine(pbf);
    else if (type === 'MultiLineString') geom.coordinates = readMultiLine(pbf);
    else if (type === 'Polygon') geom.coordinates = readMultiLine(pbf, true);
    else if (type === 'MultiPolygon') geom.coordinates = readMultiPolygon(pbf);
}

function readValue(pbf) {
    var end = pbf.readVarint() + pbf.pos,
        value = null;

    while (pbf.pos < end) {
        var val = pbf.readVarint(),
            tag = val >> 3;

        if (tag === 1) value = pbf.readString();
        else if (tag === 2) value = pbf.readDouble();
        else if (tag === 3) value = pbf.readVarint();
        else if (tag === 4) value = -pbf.readVarint();
        else if (tag === 5) value = pbf.readBoolean();
        else if (tag === 6) value = JSON.parse(pbf.readString());
    }
    return value;
}

function readProps(pbf, props) {
    var end = pbf.readVarint() + pbf.pos;
    while (pbf.pos < end) props[keys[pbf.readVarint()]] = values[pbf.readVarint()];
    values = [];
    return props;
}

function readPoint(pbf) {
    var end = pbf.readVarint() + pbf.pos,
        coords = [];
    while (pbf.pos < end) coords.push(pbf.readSVarint() / e);
    return coords;
}

function readLinePart(pbf, end, len, closed) {
    var i = 0,
        coords = [],
        p, d;

    var prevP = [];
    for (d = 0; d < dim; d++) prevP[d] = 0;

    while (len ? i < len : pbf.pos < end) {
        p = [];
        for (d = 0; d < dim; d++) {
            prevP[d] += pbf.readSVarint();
            p[d] = prevP[d] / e;
        }
        coords.push(p);
        i++;
    }
    if (closed) coords.push(coords[0]);

    return coords;
}

function readLine(pbf) {
    return readLinePart(pbf, pbf.readVarint() + pbf.pos);
}

function readMultiLine(pbf, closed) {
    var end = pbf.readVarint() + pbf.pos;
    if (!lengths) return [readLinePart(pbf, end, null, closed)];

    var coords = [];
    for (var i = 0; i < lengths.length; i++) coords.push(readLinePart(pbf, end, lengths[i], closed));
    lengths = null;
    return coords;
}

function readMultiPolygon(pbf) {
    var end = pbf.readVarint() + pbf.pos;
    if (!lengths) return [[readLinePart(pbf, end, null, true)]];

    var coords = [];
    var j = 1;
    for (var i = 0; i < lengths[0]; i++) {
        var rings = [];
        for (var k = 0; k < lengths[j]; k++) rings.push(readLinePart(pbf, end, lengths[j + 1 + k], true));
        j += lengths[j] + 1;
        coords.push(rings);
    }
    lengths = null;
    return coords;
}
