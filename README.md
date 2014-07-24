# geobuf

[![build status](https://secure.travis-ci.org/mapbox/geobuf.png)](http://travis-ci.org/mapbox/geobuf)

A [compact encoding](geobuf.proto) for geographic data.

Like [vector-tile-spec](https://github.com/mapbox/vector-tile-spec),
this is a [protobuf](http://code.google.com/p/protobuf/)-based encoding.

Unlike vector-tile-spec, this deals with untiled data in native projections.

## API

### `featureCollectionToGeobuf(geojson)`

Given a GeoJSON FeatureCollection as an object, return a Buffer of
geobuf as a [ProtoBufjs](https://github.com/dcodeIO/ProtoBuf.js) object.

### `featureToGeobuf(geojson)`

Given a GeoJSON Feature as an object, return a Buffer of
geobuf as a [ProtoBufjs](https://github.com/dcodeIO/ProtoBuf.js) object.

### `geobufToFeature(buf)`

Given a Buffer of geobuf, return a GeoJSON Feature as an object.

### `geobufToFeatureCollection(buf)`

Given a Buffer of geobuf, return a GeoJSON FeatureCollection as an object.

## Binaries

    npm install -g geobuf

Installs these nifty binaries:

* `geobuf2geojson`: turn geobuf from stdin to geojson on stdout
* `geojson2geobuf`: turn geojson from stdin to geobuf on stdout
* `shp2geobuf`: given a shapefile filename, send geobuf on stdout

## See Also

* [geojsonp](https://github.com/springmeyer/geojsonp) - the base for this project,
  this is more or less geojsonp with more wheelies.
* [twkb](https://github.com/nicklasaven/TWKB) - relative to TWKB, this is an
  implemented project that does not support topology and uses protobuf as its serialization
* [vector-tile-spec](https://github.com/mapbox/vector-tile-spec)
* [topojson](https://github.com/mbostock/topojson) - a variant of GeoJSON
  that supports topology and delta-encoding. geobuf uses delta encoding
  by virtue of using protobuf, but does not support topology
* [WKT and WKB](https://en.wikipedia.org/wiki/Well-known_text) - popular in databases.
  Not an open standard.
* [EWKB](http://postgis.refractions.net/docs/using_postgis_dbmanagement.html#EWKB_EWKT) is a popular superset of WKB.
