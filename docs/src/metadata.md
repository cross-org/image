---
title: "Metadata Support"
nav_order: 6
---

# Metadata Support

@cross/image provides comprehensive EXIF 3.0 compliant metadata support for
image files. Metadata can be embedded in and extracted from JPEG, PNG, WebP,
TIFF, HEIC, and AVIF formats.

## Supported Metadata Fields

### Basic Information

All formats support basic descriptive metadata:

- **title** - Image title
- **description** - Image description
- **author** - Creator/photographer name
- **copyright** - Copyright statement
- **creationDate** - Date/time image was created (stored as JavaScript `Date`)

### Camera Settings

Available in JPEG, TIFF, HEIC, AVIF, and WebP (via XMP):

- **cameraMake** - Camera manufacturer (e.g., "Canon", "Nikon")
- **cameraModel** - Camera model (e.g., "EOS R5", "D850")
- **lensMake** - Lens manufacturer
- **lensModel** - Lens model
- **iso** - ISO speed rating (e.g., 100, 800, 3200)
- **exposureTime** - Shutter speed in seconds (e.g., 0.004 for 1/250s)
- **fNumber** - Aperture f-number (e.g., 2.8, 5.6)
- **focalLength** - Focal length in millimeters (e.g., 50, 85)
- **flash** - Flash mode/status
- **whiteBalance** - White balance setting
- **orientation** - Image orientation (1=normal, 3=180°, 6=90°CW, 8=90°CCW)
- **software** - Software used to create/edit the image
- **userComment** - User-provided comment or notes

### GPS Coordinates

Available in JPEG, PNG, WebP, TIFF, HEIC, and AVIF via EXIF GPS IFD:

- **latitude** - Latitude in decimal degrees (-90 to 90)
- **longitude** - Longitude in decimal degrees (-180 to 180)

GPS coordinates are stored with microsecond precision and automatically
converted between decimal degrees (API) and DMS (degrees-minutes-seconds)
rationals (EXIF storage format).

### DPI Information

Available in JPEG, PNG, and TIFF:

- **dpiX** - Horizontal dots per inch
- **dpiY** - Vertical dots per inch

## Public API

### Setting Metadata

```typescript
import { Image } from "@cross/image";

const image = Image.create(800, 600);

// Set metadata (merges by default)
image.setMetadata({
  author: "Jane Photographer",
  description: "Beautiful landscape",
  copyright: "© 2024 Jane Photographer",
  creationDate: new Date("2024-06-15T18:30:00"),
  cameraMake: "Canon",
  cameraModel: "EOS R5",
  iso: 800,
  exposureTime: 0.004, // 1/250 second
  fNumber: 2.8,
  focalLength: 50,
});

// Replace all metadata (merge=false)
image.setMetadata({ author: "New Author" }, false);
```

### Reading Metadata

```typescript
// Get all metadata
const metadata = image.metadata;
console.log(metadata?.author); // "Jane Photographer"
console.log(metadata?.iso); // 800

// Get specific field
const author = image.getMetadataField("author");
const iso = image.getMetadataField("iso");
```

### GPS Coordinates

```typescript
// Set GPS position
image.setPosition(40.7128, -74.0060); // New York City

// Get GPS position
const position = image.getPosition();
if (position) {
  console.log(`Lat: ${position.latitude}, Lon: ${position.longitude}`);
}

// Can also be set via metadata
image.setMetadata({
  latitude: 51.5074,
  longitude: -0.1278, // London
});
```

### DPI Settings

```typescript
// Set DPI (both X and Y)
image.setDPI(300);

// Set different X and Y
image.setDPI(300, 150);

// Get DPI and physical dimensions
const dims = image.getDimensions();
console.log(`DPI: ${dims.dpiX}x${dims.dpiY}`);
console.log(`Physical: ${dims.physicalWidth}" x ${dims.physicalHeight}"`);
```

## Format Capability Discovery

Different image formats support different metadata fields. Use
`Image.getSupportedMetadata()` to check what's available before encoding:

```typescript
// Check JPEG support
const jpegFields = Image.getSupportedMetadata("jpeg");
console.log(jpegFields);
// ["title", "description", "author", "copyright", "creationDate",
//  "cameraMake", "cameraModel", "lensMake", "lensModel",
//  "iso", "exposureTime", "fNumber", "focalLength",
//  "flash", "whiteBalance", "orientation", "software",
//  "userComment", "latitude", "longitude", "dpiX", "dpiY"]

// Check WebP support
const webpFields = Image.getSupportedMetadata("webp");
// WebP supports basic metadata + GPS + camera settings via XMP

// Check PNG support
const pngFields = Image.getSupportedMetadata("png");
// PNG supports DateTime, GPS, DPI, and basic text metadata

// Check HEIC support
const heicFields = Image.getSupportedMetadata("heic");
// HEIC supports full camera metadata and GPS (19 fields)

// Check AVIF support
const avifFields = Image.getSupportedMetadata("avif");
// AVIF supports full camera metadata and GPS (19 fields)
```

### Format Comparison

| Format   | Fields | Implementation                                            |
| -------- | ------ | --------------------------------------------------------- |
| **JPEG** | 21     | Full EXIF (IFD0 + Exif Sub-IFD + GPS IFD)                 |
| **TIFF** | 23+    | Complete EXIF 3.0 support with InteropIFD                 |
| **HEIC** | 19     | Full EXIF metadata extraction (IFD0 + Exif Sub-IFD + GPS) |
| **AVIF** | 19     | Full EXIF metadata extraction (IFD0 + Exif Sub-IFD + GPS) |
| **WebP** | 15     | EXIF DateTime/GPS + Enhanced XMP                          |
| **PNG**  | 9      | eXIf chunk + pHYs + tEXt chunks                           |

## EXIF 3.0 Specification Compliance

The library implements comprehensive EXIF 3.0 support:

### Tag Coverage

- **30+ IFD0 tags** - Basic image information, camera make/model, orientation,
  software
- **50+ Exif Sub-IFD tags** - Complete camera settings including ISO, exposure,
  aperture, focal length, scene type, subject distance, lens specs, and more
- **GPS IFD** - Full GPS coordinate support with DMS conversion
- **InteropIFD** - Format compatibility markers (R98/sRGB, R03/Adobe RGB,
  THM/thumbnail)

### Data Types

All EXIF/TIFF data types are supported:

- BYTE, ASCII, SHORT, LONG, RATIONAL
- SBYTE, SSHORT, SLONG, SRATIONAL
- FLOAT, DOUBLE, UNDEFINED

### Metadata Storage

**JPEG:**

- IFD0 tags in APP1 EXIF marker
- Exif Sub-IFD for camera settings
- GPS IFD for coordinates
- JFIF APP0 for DPI

**PNG:**

- eXIf chunk for EXIF data (DateTime, GPS)
- pHYs chunk for DPI
- tEXt chunks for text metadata

**WebP:**

- EXIF chunk for DateTime and GPS
- XMP chunk with Dublin Core, EXIF, and TIFF namespaces for comprehensive
  metadata

**TIFF:**

- Complete IFD structure with EXIF Sub-IFD and GPS IFD
- InteropIFD for compatibility
- Native DPI in IFD tags

**HEIC:**

- EXIF metadata extraction via simplified ISOBMFF parsing
- Runtime-based encoding (metadata injection not yet implemented)
- Supports camera settings, GPS, and timestamps

**AVIF:**

- EXIF metadata extraction via simplified ISOBMFF parsing
- Runtime-based encoding (metadata injection not yet implemented)
- Supports camera settings, GPS, and timestamps

## Complete Example

```typescript
import { Image } from "@cross/image";

// Load an image
const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// Set comprehensive metadata
image.setMetadata({
  // Basic info
  author: "Jane Photographer",
  description: "Sunset over mountains",
  copyright: "© 2024 Jane Photographer. All rights reserved.",
  creationDate: new Date("2024-06-15T18:30:00"),

  // Camera settings
  cameraMake: "Canon",
  cameraModel: "EOS R5",
  lensMake: "Canon",
  lensModel: "RF 50mm F1.8 STM",
  iso: 800,
  exposureTime: 0.004, // 1/250s
  fNumber: 2.8,
  focalLength: 50,
  flash: 0, // Flash did not fire
  whiteBalance: 0, // Auto white balance
  orientation: 1, // Normal
  software: "@cross/image",
  userComment: "Amazing golden hour light",
});

// Set GPS coordinates
image.setPosition(45.4215, -75.6972); // Ottawa, Canada

// Set DPI for printing
image.setDPI(300);

// Save as JPEG (best metadata support)
const jpeg = await image.save("jpeg");
await Deno.writeFile("photo_with_metadata.jpg", jpeg);

// Load and verify metadata persisted
const loaded = await Image.decode(jpeg);
console.log("Author:", loaded.metadata?.author); // "Jane Photographer"
console.log(
  "Camera:",
  loaded.metadata?.cameraMake,
  loaded.metadata?.cameraModel,
);
console.log("ISO:", loaded.metadata?.iso); // 800
console.log("Location:", loaded.getPosition()); // { latitude: 45.4215, longitude: -75.6972 }
console.log("DPI:", loaded.getDimensions()?.dpiX); // 300

// Check what will be preserved in different formats
console.log(
  "JPEG supports:",
  Image.getSupportedMetadata("jpeg").length,
  "fields",
);
console.log(
  "WebP supports:",
  Image.getSupportedMetadata("webp").length,
  "fields",
);
console.log(
  "PNG supports:",
  Image.getSupportedMetadata("png").length,
  "fields",
);
```

## Implementation Details

### Date Precision

EXIF DateTime is stored in the format `YYYY:MM:DD HH:MM:SS` with second-level
precision. Milliseconds are not preserved when saving to EXIF formats.

### Text Encoding

All text fields use UTF-8 encoding and support Unicode characters. The library
has been tested with text fields up to 500+ characters.

### GPS Precision

GPS coordinates maintain microsecond precision (6 decimal places) through the
conversion between:

- **API**: Decimal degrees (e.g., 40.712800)
- **EXIF**: DMS rationals (40° 42' 46.08" N)

### Coordinate Validation

The API validates coordinate ranges:

- Latitude: -90 to 90 degrees
- Longitude: -180 to 180 degrees

### Metadata Utilities Module

The library includes a modular metadata handling system at
`src/utils/metadata/`:

- **exif.ts** - EXIF 3.0 tag definitions, read/write functions, InteropIFD
  operations
- **xmp.ts** - XMP packet creation and parsing with namespace support (Dublin
  Core, EXIF, TIFF)
- **gps.ts** - GPS IFD operations and DMS/decimal conversion
- **mod.ts** - Module exports

This design makes it easy to extend support to additional metadata formats like
IPTC or ICC color profiles in the future.

## Best Practices

1. **Check format capabilities** - Use `getSupportedMetadata()` before encoding
   to ensure your metadata will be preserved
2. **Use JPEG or TIFF for complete metadata** - These formats support the most
   comprehensive EXIF data
3. **Set coordinates with `setPosition()`** - This ensures proper validation and
   formatting
4. **Test roundtrips** - Encode and decode to verify metadata persistence
5. **Be aware of date precision** - EXIF only stores second-level precision, not
   milliseconds
6. **Use standard field names** - Stick to the documented metadata field names
   for compatibility

## See Also

- [API Reference](api.md) - Complete API documentation
- [Format Support](formats.md) - Details on each image format
- [Examples](examples/) - Practical usage examples
