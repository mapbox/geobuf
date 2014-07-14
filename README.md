# geobuf

[![build status](https://secure.travis-ci.org/mapbox/geobuf.png)](http://travis-ci.org/mapbox/geobuf)

A compact encoding for geographic data.

Like [vector-tile-spec](https://github.com/mapbox/vector-tile-spec),
this is a [protobuf](http://code.google.com/p/protobuf/)-based encoding.

Unlike vector-tile-spec, this deals with untiled data in native projections.

## API

### `featureToGeobuf(geojson)`

Given a GeoJSON Feature as an object, return a Buffer of geobuf.

### `geobufToFeature(buf)`

Given a Buffer of geobuf, return a GeoJSON Feature as an object.
