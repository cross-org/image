# EXIF Metadata API Test Coverage Summary

This document summarizes the test coverage for EXIF metadata reading and writing
in the @cross/image library.

## Overview

The library supports EXIF metadata for JPEG, PNG, and WebP formats through a
unified public API. This document details what is tested and how the metadata
features work.

## Supported EXIF Fields

### JPEG Format

The JPEG format implementation supports the following EXIF tags:

- **DateTime** (0x0132): Maps to `metadata.creationDate`
- **ImageDescription** (0x010E): Maps to `metadata.description`
- **Artist** (0x013B): Maps to `metadata.author`
- **Copyright** (0x8298): Maps to `metadata.copyright`
- **GPS IFD** (0x8825): GPS coordinates with the following tags:
  - **GPSLatitudeRef** (0x0001): 'N' or 'S'
  - **GPSLatitude** (0x0002): Maps to `metadata.latitude`
  - **GPSLongitudeRef** (0x0003): 'E' or 'W'
  - **GPSLongitude** (0x0004): Maps to `metadata.longitude`

DPI information is stored in JFIF APP0 marker:

- **DPI X/Y**: Maps to `metadata.dpiX` and `metadata.dpiY`

### PNG Format

PNG format stores EXIF metadata in the eXIf chunk:

- **DateTime** (0x0132): Maps to `metadata.creationDate`
- **GPS IFD** (0x8825): GPS coordinates (same structure as JPEG)

DPI information is stored in pHYs chunk:

- **Physical pixel dimensions**: Maps to `metadata.dpiX` and `metadata.dpiY`

### WebP Format

WebP format stores metadata in two types of chunks:

**EXIF chunk:**

- **DateTime** (0x0132): Maps to `metadata.creationDate`
- **GPS IFD** (0x8825): GPS coordinates (same structure as JPEG)

**XMP chunk (XML-based):**

- `dc:title`: Maps to `metadata.title`
- `dc:description`: Maps to `metadata.description`
- `dc:creator`: Maps to `metadata.author`
- `dc:rights`: Maps to `metadata.copyright`

## Public API Methods

### Metadata Management

```typescript
// Set metadata (merge by default)
image.setMetadata(metadata: ImageMetadata, merge?: boolean): Image

// Get all metadata
image.metadata: ImageMetadata | undefined

// Get specific field
image.getMetadataField<K>(key: K): ImageMetadata[K] | undefined
```

### GPS Coordinates

```typescript
// Set GPS position
image.setPosition(latitude: number, longitude: number): Image

// Get GPS position
image.getPosition(): { latitude: number; longitude: number } | undefined
```

**GPS coordinates are now fully supported!** They are written to and read from
EXIF GPS IFD tags in JPEG, PNG (eXIf chunk), and WebP (EXIF chunk) formats.
Coordinates are stored in decimal degrees with microsecond precision (converted
to/from degrees-minutes-seconds rational format in EXIF).

### DPI and Physical Dimensions

```typescript
// Set DPI
image.setDPI(dpiX: number, dpiY?: number): Image

// Get dimensions info
image.getDimensions(): {
  dpiX?: number;
  dpiY?: number;
  physicalWidth?: number;
  physicalHeight?: number;
} | undefined
```

## Test Coverage

### EXIF Metadata Tests (test/exif_metadata.test.ts)

**JPEG Format Tests:**

- ✅ Roundtrip all EXIF fields via public API
- ✅ Format direct encode/decode with all fields
- ✅ Partial metadata (only some fields)
- ✅ Special characters in text fields
- ✅ Empty metadata doesn't add EXIF chunk
- ✅ Only DPI metadata (JFIF, not EXIF)
- ✅ Date precision across various dates
- ✅ Long text fields handling (500+ characters)

**WebP Format Tests:**

- ✅ Metadata with creation date (EXIF chunk)
- ✅ Roundtrip via Image API (EXIF + XMP)
- ✅ Text metadata via XMP chunk

**Public API Tests:**

- ✅ getMetadataField for EXIF fields
- ✅ metadata property getter
- ✅ Metadata merge behavior (merge vs replace)

### GPS Metadata Tests (test/gps_metadata.test.ts)

**Public API Tests:**

- ✅ setPosition and getPosition
- ✅ getPosition returns undefined when not set
- ✅ setPosition is chainable
- ✅ Various coordinate values (positive, negative, poles, etc.)
- ✅ Coordinates via setMetadata
- ✅ Partial coordinates handling (missing lat or lon)
- ✅ Preserved during clone
- ✅ High precision coordinates
- ✅ Coordinates with other metadata fields
- ✅ Update position after initial set
- ✅ Negative coordinates

**GPS Persistence Tests:**

- ✅ JPEG roundtrip GPS coordinates (6 tests)
  - Roundtrip with single coordinate pair
  - Roundtrip with various coordinates (poles, hemispheres)
  - GPS with other metadata (author, date, etc.)
  - Via Image API
  - Only GPS metadata (no other fields)
  - High precision coordinates (6 decimal places)
- ✅ PNG roundtrip GPS coordinates (2 tests)
  - Format direct roundtrip
  - Via Image API
- ✅ WebP roundtrip GPS coordinates (2 tests)
  - Format direct roundtrip
  - Via Image API

**GPS coordinates are fully persisted!** They are written to and read from EXIF
GPS IFD tags in JPEG, PNG (eXIf chunk), and WebP (EXIF chunk) formats with
microsecond precision.

### Existing Metadata Tests (test/metadata.test.ts)

The library also has comprehensive metadata tests covering:

- Set and get metadata
- Merge metadata by default
- Replace metadata when merge=false
- Get specific metadata field
- Set and get position (GPS)
- Set and get DPI
- Custom metadata fields
- Chainable setters
- Preserved during clone
- Creation date

### Integration Tests

Metadata preservation is tested across various scenarios:

- Format conversion (PNG → JPEG, PNG → BMP, etc.)
- Image operations (resize, rotate, flip, etc.)
- Multi-frame images (TIFF, GIF)
- Encode/decode roundtrips

## Implementation Status

### ✅ Fully Implemented and Tested

- JPEG EXIF metadata reading (DateTime, ImageDescription, Artist, Copyright,
  GPS)
- JPEG EXIF metadata writing (DateTime, ImageDescription, Artist, Copyright,
  GPS)
- JPEG JFIF DPI reading and writing
- PNG EXIF DateTime reading and writing (eXIf chunk)
- PNG EXIF GPS reading and writing (eXIf chunk)
- PNG pHYs DPI reading and writing
- WebP EXIF DateTime reading and writing
- WebP EXIF GPS reading and writing
- WebP XMP metadata reading and writing
- Public API for metadata management
- Public API for GPS coordinates (fully persisted in EXIF)
- Public API for DPI

### 📋 Not Implemented

- Additional EXIF tags (camera model, ISO, focal length, orientation, etc.)
- EXIF thumbnail generation
- IPTC metadata
- JPEG ImageDescription, Artist, Copyright in PNG (eXIf chunk)

## Data Types and Constraints

### Date/Time Format

- EXIF DateTime format: `YYYY:MM:DD HH:MM:SS`
- Precision: Second-level (no milliseconds)
- Stored as JavaScript `Date` object in metadata

### Text Fields

- Encoding: UTF-8
- Maximum length: Tested up to 500+ characters
- Special characters: Fully supported (Unicode, symbols, etc.)

### GPS Coordinates

- Format: Decimal degrees (stored as DMS rationals in EXIF)
- Range: Latitude [-90, 90], Longitude [-180, 180]
- Precision: Microsecond precision (6 decimal places)
- Storage: GPS IFD with GPSLatitude, GPSLongitude, GPSLatitudeRef,
  GPSLongitudeRef tags
- Supported formats: JPEG, PNG (eXIf chunk), WebP (EXIF chunk)

### DPI

- Format: Integer dots per inch
- Default: 72 DPI when not specified
- Separate values for X and Y axes supported

## Testing Best Practices

When testing EXIF metadata:

1. **Always test roundtrip**: Encode and decode to verify persistence
2. **Test edge cases**: Empty values, special characters, very long text
3. **Test format-specific behavior**: JPEG vs PNG vs WebP have different
   implementations
4. **Verify date precision**: EXIF only stores second-level precision
5. **Test GPS precision**: Allow for small rounding errors due to DMS conversion
6. **Test public API**: Use Image class methods, not format classes directly

## Example Usage

```typescript
import { Image } from "@cross/image";

// Create or load image
const image = await Image.read(await Deno.readFile("photo.jpg"));

// Set EXIF metadata including GPS
image.setMetadata({
  author: "John Doe",
  description: "A beautiful sunset",
  copyright: "© 2024 John Doe",
  creationDate: new Date("2024-06-15T18:30:00"),
  dpiX: 300,
  dpiY: 300,
});

// Set GPS coordinates (persisted in EXIF!)
image.setPosition(40.7128, -74.0060); // NYC

// Save as JPEG (EXIF metadata will be written)
const encoded = await image.save("jpeg");
await Deno.writeFile("photo_with_exif.jpg", encoded);

// Load and verify
const loaded = await Image.read(encoded);
console.log(loaded.metadata?.author); // "John Doe"
console.log(loaded.getPosition()); // { latitude: 40.7128, longitude: -74.0060 } ✅
```

## Summary

The @cross/image library has comprehensive test coverage for EXIF metadata
reading and writing through a well-designed public API. The tests cover:

- **25 EXIF-specific tests** covering JPEG and WebP formats
- **22 GPS metadata tests** including 10 tests for GPS persistence
- **Full roundtrip testing** for all supported metadata fields including GPS
- **Edge cases** including special characters, long text, and date precision

All public API methods for metadata management are thoroughly tested and working
correctly. The implementation properly handles EXIF metadata in JPEG (APP1
marker), PNG (eXIf chunk), and WebP (EXIF/XMP chunks) formats. GPS coordinates
are fully supported across all three formats with microsecond precision.
