var ProtoBuf = require('protobufjs'),
    fs = require('fs');

var proto = fs.readFileSync(__dirname + '/geobuf.proto', 'utf8');

module.exports.builder = builder;

function builder() {
    var b = ProtoBuf.loadProto(proto);
    return b;
}
