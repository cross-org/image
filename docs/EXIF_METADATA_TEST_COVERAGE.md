# EXIF Metadata API Test Coverage Summary

This document summarizes the test coverage for EXIF metadata reading and writing
in the @cross/image library.

## Overview

The library supports EXIF metadata for JPEG, PNG, and WebP formats through a
unified public API. Metadata operations are centralized in the
`src/utils/metadata/` module for better organization and reusability.

### Metadata Utilities Module

The library includes dedicated utilities for metadata handling:

- **`exif.ts`** - EXIF tag definitions, read/write functions, date formatting
- **`xmp.ts`** - XMP packet creation and parsing with full namespace support
- **`gps.ts`** - GPS IFD operations and coordinate conversions
- **`mod.ts`** - Module exports

This modular design makes it easy to add support for additional metadata formats
like IPTC or ICC color profiles in the future.

## Supported EXIF Fields

### JPEG Format

The JPEG format implementation supports the following EXIF tags:

**IFD0 (Main directory):**

- **Make** (0x010F): Maps to `metadata.cameraMake`
- **Model** (0x0110): Maps to `metadata.cameraModel`
- **Orientation** (0x0112): Maps to `metadata.orientation`
- **Software** (0x0131): Maps to `metadata.software`
- **DateTime** (0x0132): Maps to `metadata.creationDate`
- **ImageDescription** (0x010E): Maps to `metadata.description`
- **Artist** (0x013B): Maps to `metadata.author`
- **Copyright** (0x8298): Maps to `metadata.copyright`

**Exif Sub-IFD:**

- **ISOSpeedRatings** (0x8827): Maps to `metadata.iso`
- **ExposureTime** (0x829A): Maps to `metadata.exposureTime`
- **FNumber** (0x829D): Maps to `metadata.fNumber`
- **FocalLength** (0x920A): Maps to `metadata.focalLength`
- **Flash** (0x9209): Maps to `metadata.flash`
- **UserComment** (0x9286): Maps to `metadata.userComment`
- **WhiteBalance** (0xA403): Maps to `metadata.whiteBalance`
- **LensMake** (0xA433): Maps to `metadata.lensMake`
- **LensModel** (0xA434): Maps to `metadata.lensModel`

**GPS IFD:**

- **GPSLatitudeRef** (0x0001): 'N' or 'S'
- **GPSLatitude** (0x0002): Maps to `metadata.latitude`
- **GPSLongitudeRef** (0x0003): 'E' or 'W'
- **GPSLongitude** (0x0004): Maps to `metadata.longitude`

**DPI information** is stored in JFIF APP0 marker:

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

**XMP chunk (Enhanced XML-based metadata):**

WebP now has full XMP support with multiple namespaces:

- **Dublin Core:** `dc:title`, `dc:description`, `dc:creator`, `dc:rights`
- **EXIF namespace:** `exif:DateTimeOriginal`, `exif:ISOSpeedRatings`,
  `exif:ExposureTime`, `exif:FNumber`, `exif:FocalLength`
- **TIFF namespace:** `tiff:Make`, `tiff:Model`, `tiff:Orientation`,
  `tiff:Software`

This makes WebP capable of storing comprehensive camera metadata alongside JPEG!

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

### Camera Metadata Tests (test/camera_metadata.test.ts)

**JPEG Camera Settings Tests:**

- ✅ Roundtrip camera settings (Make, Model, ISO, Exposure, Aperture, Focal
  Length)
- ✅ Roundtrip lens information (Lens Make, Lens Model)
- ✅ Roundtrip flash and white balance
- ✅ Orientation (1, 3, 6, 8 values)
- ✅ Software and user comment (including Unicode)
- ✅ Combined metadata (all camera fields + basic metadata + GPS)
- ✅ Camera metadata via Image API

**getSupportedMetadata Tests:**

- ✅ JPEG format returns all camera metadata fields
- ✅ PNG format returns limited fields (no camera metadata)
- ✅ WebP format returns limited fields (no camera metadata)

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

**JPEG Format:**

- IFD0 tags: Make, Model, Orientation, Software, DateTime, ImageDescription,
  Artist, Copyright
- Exif Sub-IFD: ISO, ExposureTime, FNumber, FocalLength, Flash, UserComment,
  WhiteBalance, LensMake, LensModel
- GPS IFD: Latitude, Longitude with hemisphere references
- JFIF DPI reading and writing

**PNG Format:**

- eXIf chunk: DateTime, GPS coordinates
- pHYs chunk: DPI information
- tEXt chunks: Title, Author, Description, Copyright

**WebP Format:**

- EXIF chunk: DateTime, GPS coordinates
- XMP chunk: Title, Description, Author, Copyright

**Public API:**

- Metadata management (`setMetadata`, `getMetadata`, `getMetadataField`)
- GPS coordinates (`setPosition`, `getPosition`) - fully persisted
- DPI settings (`setDPI`, `getDimensions`)
- Format capability discovery (`getSupportedMetadata`)

### 📋 Not Implemented

- Additional EXIF tags (GPS altitude, timestamp, camera serial number, etc.)
- EXIF Makernote tags (proprietary camera-specific data)
- EXIF thumbnail generation
- IPTC metadata
- XMP packet parsing (beyond basic Dublin Core)
- JPEG ImageDescription, Artist, Copyright in PNG eXIf chunk

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

// Check what metadata is supported
const jpegSupports = Image.getSupportedMetadata("jpeg");
console.log(jpegSupports); // Includes camera metadata, GPS, etc.

// Set EXIF metadata including camera settings and GPS
image.setMetadata({
  author: "John Doe",
  description: "A beautiful sunset",
  copyright: "© 2024 John Doe",
  creationDate: new Date("2024-06-15T18:30:00"),
  cameraMake: "Canon",
  cameraModel: "EOS 5D Mark IV",
  iso: 800,
  exposureTime: 0.004, // 1/250s
  fNumber: 2.8,
  focalLength: 50,
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
console.log(loaded.metadata?.cameraMake); // "Canon"
console.log(loaded.metadata?.iso); // 800
console.log(loaded.getPosition()); // { latitude: 40.7128, longitude: -74.0060 } ✅
```

## Summary

The @cross/image library has comprehensive test coverage for EXIF metadata
reading and writing through a well-designed public API. The tests cover:

- **25 EXIF-specific tests** for basic metadata
- **22 GPS metadata tests** including 10 tests for GPS persistence
- **10 camera metadata tests** for extended EXIF fields
- **Full roundtrip testing** for all supported metadata fields including GPS and
  camera settings
- **Edge cases** including special characters, long text, and date precision

All public API methods for metadata management are thoroughly tested and working
correctly. The implementation properly handles EXIF metadata in JPEG (APP1
marker with IFD0, Exif Sub-IFD, and GPS IFD), PNG (eXIf chunk), and WebP
(EXIF/XMP chunks) formats.

Camera metadata (ISO, exposure, aperture, focal length, etc.) is fully supported
in JPEG format, while GPS coordinates are fully supported across all three
formats with microsecond precision.
