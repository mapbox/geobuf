'use strict';

module.exports = decode;

var keys, values, lengths, dim, e, isTopo, transformed, names;

var geometryTypes = ['Point', 'MultiPoint', 'LineString', 'MultiLineString',
                      'Polygon', 'MultiPolygon', 'GeometryCollection'];

function decode(pbf) {
    dim = 2;
    e = Math.pow(10, 6);
    isTopo = false;
    transformed = false;

    keys = [];
    values = [];
    var obj = pbf.readFields(readDataField, {});
    keys = null;

    return obj;
}

function readDataField(tag, obj, pbf) {
    if (tag === 1) keys.push(pbf.readString());
    else if (tag === 2) dim = pbf.readVarint();
    else if (tag === 3) e = Math.pow(10, pbf.readVarint());

    else if (tag === 4) readFeatureCollection(pbf, obj);
    else if (tag === 5) readFeature(pbf, obj);
    else if (tag === 6) readGeometry(pbf, obj);
    else if (tag === 7) readTopology(pbf, obj);
}

function readFeatureCollection(pbf, obj) {
    obj.type = 'FeatureCollection';
    obj.features = [];
    return pbf.readMessage(readFeatureCollectionField, obj);
}

function readFeature(pbf, feature) {
    feature.type = 'Feature';
    return pbf.readMessage(readFeatureField, feature);
}

function readGeometry(pbf, geom) {
    return pbf.readMessage(readGeometryField, geom);
}

function readTopology(pbf, topology) {
    isTopo = true;
    topology.type = 'Topology';
    topology.objects = {};
    names = [];
    pbf.readMessage(readTopologyField, topology);
    names = null;
    return topology;
}

function readTopologyField(tag, topology, pbf) {
    if (tag === 1) {
        topology.transform = pbf.readMessage(readTransformField, {scale: [], translate: []});
        transformed = true;
    }
    else if (tag === 2) names.push(pbf.readString());
    else if (tag === 3) topology.objects[names.unshift()] = pbf.readMessage(readGeometryField, {});

    else if (tag === 4) lengths = pbf.readPackedVarint();
    else if (tag === 5) topology.arcs = readArcs(pbf);

    else if (tag === 13) values.push(readValue(pbf));
    else if (tag === 15) readProps(pbf, topology);
}

function readFeatureCollectionField(tag, obj, pbf) {
    if (tag === 1) obj.features.push(readFeature(pbf, {}));

    else if (tag === 13) values.push(readValue(pbf));
    else if (tag === 15) readProps(pbf, obj);
}

function readFeatureField(tag, feature, pbf) {
    if (tag === 1) feature.geometry = readGeometry(pbf, {});

    else if (tag === 11) feature.id = pbf.readString();
    else if (tag === 12) feature.id = pbf.readSVarint();

    else if (tag === 13) values.push(readValue(pbf));
    else if (tag === 14) feature.properties = readProps(pbf, {});
    else if (tag === 15) readProps(pbf, feature);
}

function readGeometryField(tag, geom, pbf) {
    if (tag === 1) geom.type = geometryTypes[pbf.readVarint()];

    else if (tag === 2) lengths = pbf.readPackedVarint();
    else if (tag === 3) {
        if (isTopo) geom.arcs = readCoords(pbf, geom.type);
        else geom.coordinates = readCoords(pbf, geom.type);

    } else if (tag === 4) {
        geom.geometries = geom.geometries || [];
        geom.geometries.push(readGeometry(pbf, {}));
    }

    else if (tag === 11) geom.id = pbf.readString();
    else if (tag === 12) geom.id = pbf.readSVarint();

    else if (tag === 13) values.push(readValue(pbf));
    else if (tag === 14) geom.properties = readProps(pbf, {});
    else if (tag === 15) readProps(pbf, geom);
}

function readCoords(pbf, type) {
    if (type === 'Point') return readPoint(pbf);
    else if (type === 'MultiPoint') return readLine(pbf, true);
    else if (type === 'LineString') return readLine(pbf);
    else if (type === 'MultiLineString' || type === 'Polygon') return readMultiLine(pbf);
    else if (type === 'MultiPolygon') return readMultiPolygon(pbf);
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

function readTransformField(tag, tr, pbf) {
    if (tag === 1) tr.scale[0] = pbf.readDouble();
    else if (tag === 2) tr.scale[1] = pbf.readDouble();
    else if (tag === 3) tr.translate[0] = pbf.readDouble();
    else if (tag === 4) tr.translate[1] = pbf.readDouble();
}

function readPoint(pbf) {
    var end = pbf.readVarint() + pbf.pos,
        coords = [];
    while (pbf.pos < end) coords.push(pbf.readSVarint() / e);
    return coords;
}

function readLinePart(pbf, end, len, isMultiPoint) {
    var i = 0,
        coords = [];

    if (isTopo && !isMultiPoint) {
        var p = 0;
        while (len ? i < len : pbf.pos < end) {
            p += pbf.readSVarint();
            coords.push(p);
            i++;
        }

    } else {
        var prevP = [];
        for (var d = 0; d < dim; d++) prevP[d] = 0;

        while (len ? i < len : pbf.pos < end) {
            var p = [];
            for (var d = 0; d < dim; d++) {
                prevP[d] += pbf.readSVarint();
                p[d] = prevP[d] / e;
                // TODO no-transform TopoJSON
            }
            coords.push(p);
            i++;
        }
    }

    return coords;
}

function readLine(pbf, isMultiPoint) {
    return readLinePart(pbf, pbf.readVarint() + pbf.pos, null, isMultiPoint);
}

function readMultiLine(pbf) {
    var end = pbf.readVarint() + pbf.pos;
    if (!lengths) return [readLinePart(pbf, end)];

    var coords = [];
    for (var i = 0; i < lengths.length; i++) coords.push(readLinePart(pbf, end, lengths[i]));
    lengths = null;
    return coords;
}

function readMultiPolygon(pbf) {
    var end = pbf.readVarint() + pbf.pos;
    if (!lengths) return [[readLinePart(pbf, end)]];

    var coords = [];
    var j = 1;
    for (var i = 0; i < lengths[0]; i++) {
        var rings = [];
        for (var k = 0; k < lengths[j]; k++) rings.push(readLinePart(pbf, end, lengths[j + 1 + k]));
        j += lengths[j] + 1;
        coords.push(rings);
    }
    lengths = null;
    return coords;
}

function readArcs(pbf) {
    var lines = [],
        end = pbf.readVarint() + pbf.pos;

    for (var i = 0; i < lengths.length; i++) {
        var ring = [];
        for (var j = 0; j < lengths[i]; j++) {
            var p = [];
            for (var d = 0; d < dim; d++) p[d] = pbf.readSVarint();
            ring.push(p);
        }
        lines.push(ring);
    }

    return lines;
}
