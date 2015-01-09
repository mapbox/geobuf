# Geobuf

[![build status](https://secure.travis-ci.org/mapbox/geobuf.png)](http://travis-ci.org/mapbox/geobuf)

Geobuf is a compact binary encoding for geographic data.

Geobuf provides _lossless_ compression of GeoJSON and TopoJSON data
into [protocol buffers](https://developers.google.com/protocol-buffers/).
Advantages over using GeoJSON and TopoJSON directly:

- **Very compact**: typically makes GeoJSON 6-8 times smaller and TopoJSON 2-3 times smaller.
- Smaller even when comparing gzipped sizes: 2-2.5x compression for GeoJSON and 20-30% for TopoJSON.
- **Very fast encoding and decoding** - even faster than just native JSON implementations (i.e. in Web browsers).
- Easy **incremental parsing** &mdash; you can get features out as you read them,
without the need to build in-memory representation of the whole data.
- **Partial reads** &mdash; you can read only the parts you actually need, skipping the rest.
- Can accommodate any GeoJSON and TopoJSON data, including extensions with arbitrary properties.

Think of this as an attempt to design a simple, modern Shapefile successor
that works seamlessly with GeoJSON and TopoJSON.

Unlike [Mapbox Vector Tiles](https://github.com/mapbox/vector-tile-spec/), it aims for _lossless_ compression
of datasets &mdash; without tiling, projecting coordinates, flattening geometries or stripping properties.

## API

### `geobuf.encode(json, pbf)`

Given a GeoJSON or TopoJSON object and a [Pbf](https://github.com/mapbox/pbf) object to write to,
return a Geobuf as a `Buffer` object in Node or `UInt8Array` object in browsers.

```js
var buffer = geobuf.encode(geojson, new Pbf());
```

### `geobuf.decode(pbf)`

Given a [Pbf](https://github.com/mapbox/pbf) object with Geobuf data, return a GeoJSON or TopoJSON object.

```js
var topojson = geobuf.decode(new Pbf(data));
```

## Binaries

    npm install -g geobuf

Installs these nifty binaries:

* `geobuf2json`: turn Geobuf from stdin to GeoJSON/TopoJSON on stdout
* `json2geobuf`: turn GeoJSON or TopoJSON from stdin to Geobuf on stdout
* `shp2geobuf`: given a Shapefile filename, send Geobuf on stdout

```bash
json2geobuf < data.json > data.pbf
shp2geobuf myshapefile > data.pbf
geobuf2json < data.pbf > data.json
```

## See Also

* [geojsonp](https://github.com/springmeyer/geojsonp) - the original base for this project
* [twkb](https://github.com/nicklasaven/TWKB) - relative to TWKB, this is an
  implemented project that does not support topology and uses protobuf as its serialization
* [vector-tile-spec](https://github.com/mapbox/vector-tile-spec)
* [topojson](https://github.com/mbostock/topojson) - an extension of GeoJSON that supports topology
* [WKT and WKB](https://en.wikipedia.org/wiki/Well-known_text) - popular in databases. Not an open standard.
* [EWKB](http://postgis.refractions.net/docs/using_postgis_dbmanagement.html#EWKB_EWKT) is a popular superset of WKB.
