var Pbf = require('pbf'),
    fs = require('fs');

var data = fs.readFileSync('../pygeobuf/fixtures/tmp/zips.pbf');

var pbf = new Pbf(data);

var keys = [],
    values = [],
    lengths,
    dim = 2,
    e = Math.pow(10, 6);

var geometryTypes = ['Point', 'MultiPoint', 'LineString', 'MultiLineString',
                      'Polygon', 'MultiPolygon', 'GeometryCollection'];

console.time('decode');
var obj = decode(pbf);
console.timeEnd('decode');

var json = JSON.stringify(obj);

console.time('JSON.parse');
JSON.parse(json);
console.timeEnd('JSON.parse');

// console.log(JSON.stringify(obj));

function decode(pbf) {
    var obj = pbf.readFields(readDataField, {});
    keys = [];
    return obj;
}

function readDataField(tag, obj, pbf) {
    if (tag === 1) keys.push(pbf.readString());
    else if (tag === 2) dim = pbf.readVarint();
    else if (tag === 3) e = Math.pow(10, pbf.readVarint());
    else if (tag === 4) {
        obj.type = 'FeatureCollection';
        obj.features = pbf.readMessage(readFeatureCollectionField, []);

    } else if (tag === 5) readFeature(pbf, obj);
    else if (tag === 6) readGeometry(pbf, obj);
    // TODO TopoJSON stuff
    // TODO custom props
}

function readFeatureCollectionField(tag, features, pbf) {
    if (tag === 1) features.push(readFeature(pbf, {}));
    // TODO custom props
}

function readFeature(pbf, feature) {
    feature.type = 'Feature';
    return pbf.readMessage(readFeatureField, feature);
}

function readFeatureField(tag, feature, pbf) {
    if (tag === 1) feature.geometry = readGeometry(pbf, {});
    else if (tag === 11) feature.id = pbf.readString();
    else if (tag === 12) feature.id = pbf.readSVarint();
    else if (tag === 13) values.push(readValue(pbf));
    else if (tag === 14) feature.properties = readProps(pbf, {});
    else if (tag === 15) readProps(pbf, feature);
}

function readProps(pbf, props) {
    var end = pbf.readVarint() + pbf.pos;
    while (pbf.pos < end) props[keys[pbf.readVarint()]] = values[pbf.readVarint()];
    values = [];
    return props;
}

function readValue(pbf) {
    var end = pbf.readVarint() + pbf.pos,
        value = null;
    while (pbf.pos < end) {
        var val = pbf.readVarint(),
            tag = val >> 3;
        if (tag === 1) value = pbf.readString();
        else if (tag === 2) value = pbf.readDouble();
        else if (tag === 3) value = pbf.readSVarint();
        else if (tag === 4) value = pbf.readVarint();
        else if (tag === 6) value = pbf.readBoolean();
        else if (tag === 7) value = JSON.parse(pbf.readString());
    }
    return value;
}

function readGeometry(pbf, geom) {
    pbf.readMessage(readGeometryField, geom);
    lengths = null;
    return geom;
}

function readGeometryField(tag, geom, pbf) {
    if (tag === 1) geom.type = geometryTypes[pbf.readVarint()];
    else if (tag === 2) lengths = pbf.readPackedVarint();
    else if (tag === 3) geom.coordinates = readCoords(pbf, geom.type);
    // TODO geometries
    // TODO custom props
}

function readCoords(pbf, type) {
    if (type === 'MultiLineString' || type === 'Polygon') return readMultiLine(pbf);
}

function readMultiLine(pbf) {
    var end = pbf.readVarint() + pbf.pos;

    if (!lengths) return [readLine(pbf, end)];

    var coords = [];
    for (var i = 0; i < lengths.length; i++) coords.push(readLine(pbf, end, lengths[i]));
    return coords;
}

function readLine(pbf, end, len) {
    var i = 0,
        coords = [],
        prevP = [];

    for (var d = 0; d < dim; d++) prevP[d] = 0;

    while (pbf.pos < end && (!len || i < len)) {
        var p = [];
        for (var d = 0; d < dim; d++) {
            prevP[d] += pbf.readSVarint();
            p[d] = prevP[d] / e;
        }
        coords.push(p);
        i++;
    }
    return coords;
}
