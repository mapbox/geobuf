# Geobuf

[![Build Status](https://travis-ci.org/mapbox/geobuf.svg)](https://travis-ci.org/mapbox/geobuf)
[![Coverage Status](https://img.shields.io/coveralls/mapbox/geobuf.svg)](https://coveralls.io/r/mapbox/geobuf)

Geobuf is a compact binary encoding for geographic data.

Geobuf provides _nearly lossless_ compression of GeoJSON data
into [protocol buffers](https://developers.google.com/protocol-buffers/).
Advantages over using GeoJSON alone:

- **Very compact**: typically makes GeoJSON 6-8 times smaller.
- 2-2.5x smaller even when comparing gzipped sizes.
- **Very fast encoding and decoding** &mdash; even faster than native JSON parse/stringify.
- Can accommodate any GeoJSON data, including extensions with arbitrary properties.

The [encoding format](geobuf.proto) also potentially allows:

- Easy **incremental parsing** &mdash; get features out as you read them,
without the need to build in-memory representation of the whole data.
- **Partial reads** &mdash; read only the parts you actually need, skipping the rest.

Think of this as an attempt to design a simple, modern Shapefile successor
that works seamlessly with GeoJSON.
Unlike [Mapbox Vector Tiles](https://github.com/mapbox/vector-tile-spec/),
it aims for nearly lossless compression of datasets &mdash; without tiling, projecting coordinates,
flattening geometries or stripping properties.

Note that the encoding schema is **not stable yet** &mdash;
it may still change as we get community feedback and discover new ways to improve it.

"Nearly" lossless means coordinates are encoded with precision of 6 digits after the decimal point (about 10cm).


#### Sample compression sizes

Data                | JSON      | JSON (gz) | Geobuf   | Geobuf (gz)
------------------- | --------: | --------: | -------: | ----------:
US zip codes        | 101.85 MB | 26.67 MB  | 12.24 MB | 10.48 MB
Idaho counties      | 10.92 MB  | 2.57 MB   | 1.37 MB  | 1.17 MB

## API

### encode

```js
var buffer = geobuf.encode(geojson, new Pbf());
```

Given a GeoJSON object and a [Pbf](https://github.com/mapbox/pbf) object to write to,
returns a Geobuf as `UInt8Array` array of bytes.
In Node@4.5.0 or later, you can use `Buffer.from` to convert back to a buffer.

### decode

```js
var geojson = geobuf.decode(new Pbf(data));
```

Given a [Pbf](https://github.com/mapbox/pbf) object with Geobuf data, return a GeoJSON object. When loading Geobuf data over `XMLHttpRequest`, you need to set `responseType` to [`arraybuffer`](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/responseType).


## Install

Node and Browserify:

```bash
npm install geobuf
```

Browser build CDN links:

- https://unpkg.com/geobuf@3.0.0/dist/geobuf.js
- https://unpkg.com/geobuf@3.0.0/dist/geobuf-dev.js

Building locally:

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

* `geobuf2json`: turn Geobuf from `stdin` or specified file to GeoJSON on `stdout`
* `json2geobuf`: turn GeoJSON from `stdin` or specified file to Geobuf on `stdout`
* `shp2geobuf`: given a Shapefile filename, send Geobuf on `stdout`

```bash
json2geobuf data.json > data.pbf
shp2geobuf myshapefile > data.pbf
geobuf2json data.pbf > data.json
```

Note that for big files, `geobuf2json` command can be pretty slow, but the bottleneck is not the decoding,
but the native `JSON.stringify` on the decoded object to pipe it as a string to `stdout`.
On some files, this step may take 40 times more time than actual decoding.


## See Also

* [geojsonp](https://github.com/springmeyer/geojsonp) &mdash; the prototype that led to this project
* [pygeobuf](https://github.com/pygeobuf/pygeobuf) &mdash; Python implementation of Geobuf
* [twkb](https://github.com/TWKB/Specification) &mdash; a geospatial binary encoding that doesn't support topology
and doesn't encode any non-geographic properties besides `id`
* [vector-tile-spec](https://github.com/mapbox/vector-tile-spec)
* [topojson](https://github.com/mbostock/topojson) &mdash; an extension of GeoJSON that supports topology
* [WKT and WKB](https://en.wikipedia.org/wiki/Well-known_text) &mdash; popular in databases
* [EWKB](http://postgis.refractions.net/docs/using_postgis_dbmanagement.html#EWKB_EWKT) &mdash; a popular superset of WKB
