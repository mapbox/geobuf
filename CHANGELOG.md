## Geobuf Changelog

### master

- **Breaking:** removed TopoJSON support. It will likely branch out into a separate repo/project.

### 1.0.1 (Jan 13, 2015)

- Fixed a bug that sometimes led to a freeze when encoding high-precision data.
- `json2geobuf` and `geobuf2json` executables now also accept filename in addition to stdin

### 1.0.0 (Jan 11, 2015)

A complete redesign and rewrite of Geobuf. Most notable improvements:

- 4-6 times smaller file sizes
- 3-4 faster encoding and decoding
- TopoJSON support
- arbitrary and nested properties support
- easier API (just `encode` and `decode` methods that accept any kind of data)

Note that it's not compatible with the previous version.
Old Geobuf files will need to be decoded using version 0.2.2.
