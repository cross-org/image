# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Fault-tolerant decoding modes for GIF, WebP, and JPEG formats
- `GIFDecoderOptions` interface with `tolerantDecoding` option for frame-level
  error recovery
- `WebPDecoderOptions` interface with `tolerantDecoding` option for pixel-level
  error recovery
- `JPEGDecoderOptions` now exported from main module for advanced usage
- Comprehensive documentation for fault-tolerant decoding in README.md
- Tests for fault-tolerant modes in GIF and WebP decoders

### Fixed

- JPEG roundtrip encoding now clamps DCT coefficients to valid Huffman table
  ranges, preventing "Invalid Huffman code" errors when re-encoding decoded
  JPEGs

### Performance

- Optimized JPEG encoder/decoder with typed arrays (Float32Array, Int32Array,
  Uint8Array) for better memory efficiency and performance
- Optimized WebP encoder/decoder with typed arrays (Uint8Array, Uint32Array) for
  improved performance
- Reduced memory allocations in hot paths for DCT/IDCT operations
- Optimized image processing operations with lookup tables and reduced Math
  function calls
- Optimized resize operations (nearest, bilinear) with bitwise operations and
  pre-computed values
- Optimized rotation and flip operations using Uint32Array views and batch
  copying
- Optimized crop operation with row-based batch copying
- Optimized composite operation by reducing redundant calculations in inner loops
- Optimized Gaussian blur with pre-computed offsets and reduced Math function
  calls

## 0.2.4 - 2025-12-11

### Added

- HEIC format support with runtime-based encode/decode (requires
  ImageDecoder/OffscreenCanvas API)
- AVIF format support with runtime-based encode/decode (requires
  ImageDecoder/OffscreenCanvas API)
- `Image.extractMetadata()` static method to extract metadata without decoding
  pixel data
- Metadata extraction support for all formats (PNG, APNG, JPEG, WebP, GIF, TIFF,
  BMP, ICO, DNG, PAM, PCX, PPM, ASCII, HEIC, AVIF)
- New metadata fields: `format`, `compression`, `frameCount`, `bitDepth`,
  `colorType`
- Enhanced HEIC/AVIF metadata extraction with comprehensive EXIF parsing (19
  fields including GPS and camera settings)
- Enhanced WebP metadata with XMP support including camera metadata
- Rotation and flip methods: `rotate()`, `rotate90()`, `rotate180()`,
  `rotate270()`, `flipHorizontal()`, `flipVertical()`
- `Image.getSupportedMetadata()` method to check which metadata fields are
  supported per format (now implemented for all 15 formats)
- EXIF orientation correction examples in documentation
- CONTRIBUTING.md with development guidelines
- CHANGELOG.md to track version history
- Enhanced npm package metadata with comprehensive keywords
- Node.js engines field in package.json (>=18.0.0)
- Improved .npmignore to exclude test and documentation files
- `.editorconfig` for consistent coding styles across editors

### Changed

- Updated all tests to use `test()` from `@cross/test` instead of `Deno.test`
  for cross-runtime compatibility
- Enhanced documentation with missing API methods (rotation/flip, metadata
  extraction, resize modes)
- Updated `ResizeOptions` documentation to include `bicubic` method and
  `fit`/`cover`/`contain` modes
- Completed `TIFFEncodeOptions` documentation with `grayscale` and `rgb` options
- Updated README and documentation to reflect HEIC/AVIF format support
- Improved EXIF parsing in HEIC and AVIF with safety bounds checks (max 100
  entries)

### Fixed

- WebP frame count state management to avoid undefined states
- Cross-runtime test compatibility by replacing `Deno.test` with `@cross/test`

## [0.2.3] - 2025-12-10

### Added

- Initial release baseline (no changes from 0.2.2, tag creation only)

## [0.2.2] - 2025-12-10

### Changed

- Documentation alignment with implemented API

## [0.2.1] - Previous releases

See [GitHub Releases](https://github.com/cross-org/image/releases) for the full
history of previous releases.

---

[Unreleased]: https://github.com/cross-org/image/compare/v0.2.3...HEAD
[0.2.3]: https://github.com/cross-org/image/releases/tag/v0.2.3
[0.2.2]: https://github.com/cross-org/image/releases/tag/v0.2.2
