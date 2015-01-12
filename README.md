# Geobuf

[![Build Status](https://travis-ci.org/mapbox/geobuf.svg)](https://travis-ci.org/mapbox/geobuf)
[![Coverage Status](https://img.shields.io/coveralls/mapbox/geobuf.svg)](https://coveralls.io/r/mapbox/geobuf)

Geobuf is a compact binary encoding for geographic data.

Geobuf provides _lossless_ compression of GeoJSON and TopoJSON data
into [protocol buffers](https://developers.google.com/protocol-buffers/).
Advantages over using JSON-based formats alone:

- **Very compact**: typically makes GeoJSON 6-8 times smaller and TopoJSON 2-3 times smaller.
- Smaller even when comparing gzipped sizes: 2-2.5x compression for GeoJSON and 20-30% for TopoJSON.
- **Very fast encoding and decoding** &mdash; even faster than native JSON parse/stringify.
- Can accommodate any GeoJSON and TopoJSON data, including extensions with arbitrary properties.

The [encoding format](geobuf.proto) also potentially allows:

- Easy **incremental parsing** &mdash; get features out as you read them,
without the need to build in-memory representation of the whole data.
- **Partial reads** &mdash; read only the parts you actually need, skipping the rest.

Think of this as an attempt to design a simple, modern Shapefile successor
that works seamlessly with GeoJSON and TopoJSON.
Unlike [Mapbox Vector Tiles](https://github.com/mapbox/vector-tile-spec/),
it aims for _lossless_ compression of datasets &mdash; without tiling, projecting coordinates,
flattening geometries or stripping properties.

#### Sample compression sizes

                    | normal    | gzipped
------------------- | --------- | --------
us-zips.json 	    | 101.85 MB | 26.67 MB
us-zips.pbf         | 12.24 MB  | 10.48 MB
us-zips.topo.json   | 15.02 MB  | 3.19 MB
us-zips.topo.pbf    | 4.85 MB   | 2.72 MB
idaho.json          | 10.92 MB  | 2.57 MB
idaho.pbf           | 1.37 MB   | 1.17 MB
idaho.topo.json     | 1.9 MB    | 612 KB
idaho.topo.pbf      | 567 KB    | 479 KB


## API

### encode

```js
var buffer = geobuf.encode(geojson, new Pbf());
```

Given a GeoJSON or TopoJSON object and a [Pbf](https://github.com/mapbox/pbf) object to write to,
returns a Geobuf as a `Buffer` object in Node or `UInt8Array` object in browsers.

### decode

```js
var geojson = geobuf.decode(new Pbf(data));
```

Given a [Pbf](https://github.com/mapbox/pbf) object with Geobuf data, return a GeoJSON or TopoJSON object.


## Install

Node and Browserify:

```bash
npm install geobuf
```

Making a browser build:

```bash
npm install
npm run build-dev # dist/geobuf-dev.js (development build)
npm run build-min # dist/geobuf.js (minified production build)
```


## Command Line

```bash
npm install -g geobuf
```

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

* [geojsonp](https://github.com/springmeyer/geojsonp) &mdash; the prototype that led to this project
* [twkb](https://github.com/TWKB/Specification) &mdash; a geospatial binary encoding that doesn't support topology
and doesn't encode any non-geographic properties besides `id`
* [vector-tile-spec](https://github.com/mapbox/vector-tile-spec)
* [topojson](https://github.com/mbostock/topojson) &mdash; an extension of GeoJSON that supports topology
* [WKT and WKB](https://en.wikipedia.org/wiki/Well-known_text) &mdash; popular in databases. Not an open standard.
* [EWKB](http://postgis.refractions.net/docs/using_postgis_dbmanagement.html#EWKB_EWKT) is a popular superset of WKB.
