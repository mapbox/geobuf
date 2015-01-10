## 1.0.0

A complete redesign and rewrite of Geobuf. Most notable improvements:

- 4-6 times smaller file sizes
- 3-4 faster encoding and decoding
- TopoJSON support
- arbitrary and nested properties support
- easier API (just `encode` and `decode` methods that accept any kind of data)

Note that it's not compatible with the previous version.
Old Geobuf files will need to be decoded using version 0.2.2.
