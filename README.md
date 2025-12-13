# @cross/image

A pure JavaScript, dependency-free, cross-runtime image processing library for
Deno, Node.js, and Bun. Decode, encode, manipulate, and process images in
multiple formats including PNG, JPEG, WebP, GIF, and more—all without native
dependencies.

📚 **[Full Documentation](https://cross-image.56k.guru/)**

## Features

- 🚀 **Pure JavaScript** - No native dependencies
- 🔌 **Pluggable formats** - Easy to extend with custom formats
- 📦 **Cross-runtime** - Works on Deno, Node.js (18+), and Bun
- 🎨 **Multiple formats** - PNG, APNG, JPEG, WebP, GIF, TIFF, BMP, ICO, DNG,
  PAM, PPM, PCX, ASCII, HEIC, and AVIF support
- ✂️ **Image manipulation** - Resize, crop, composite, and more
- 🎛️ **Image processing** - Chainable filters including `brightness`,
  `contrast`, `saturation`, `hue`, `exposure`, `blur`, `sharpen`, `sepia`, and
  more
- 🖌️ **Drawing operations** - Create, fill, and manipulate pixels
- 🧩 **Multi-frame** - Decode/encode animated GIFs, APNGs and multi-page TIFFs
- 🔧 **Simple API** - Easy to use, intuitive interface

## Installation

### Deno

```ts
import { Image } from "jsr:@cross/image";
```

### Node.js

```bash
npm install cross-image
```

```ts
import { Image } from "cross-image";
```

### Bun

```bash
npm install cross-image
```

```ts
import { Image } from "cross-image";
```

## Quick Start

### Deno

```ts
import { Image } from "@cross/image";

// Decode an image (auto-detects format)
const data = await Deno.readFile("input.png");
const image = await Image.decode(data);

console.log(`Image size: ${image.width}x${image.height}`);

// Create a new blank image
const canvas = Image.create(800, 600, 255, 255, 255); // white background

// Composite the loaded image on top
canvas.composite(image, 50, 50);

// Apply image processing filters
canvas
  .brightness(0.1)
  .contrast(0.2)
  .saturation(-0.1)
  .blur(1)
  .sharpen(0.3);

// Encode in a different format
const jpeg = await canvas.encode("jpeg");
await Deno.writeFile("output.jpg", jpeg);
```

### Node.js

```ts
import { Image } from "cross-image";
import { readFile, writeFile } from "node:fs/promises";

// Read an image (auto-detects format)
const data = await readFile("input.png");
const image = await Image.decode(data);

console.log(`Image size: ${image.width}x${image.height}`);

// Resize the image
image.resize({ width: 800, height: 600 });

// Save in a different format
const jpeg = await image.encode("jpeg");
await writeFile("output.jpg", jpeg);
```

## Supported Formats

| Format | Pure-JS                   | Notes                                             |
| ------ | ------------------------- | ------------------------------------------------- |
| PNG    | ✅ Full                   | Complete pure-JS implementation                   |
| APNG   | ✅ Full                   | Animated PNG with multi-frame                     |
| BMP    | ✅ Full                   | Complete pure-JS implementation                   |
| ICO    | ✅ Full                   | Windows Icon format                               |
| GIF    | ✅ Full                   | Animated GIF with multi-frame                     |
| DNG    | ✅ Full                   | Linear DNG (Uncompressed RGBA)                    |
| PAM    | ✅ Full                   | Netpbm PAM format                                 |
| PPM    | ✅ Full                   | Netpbm PPM format (P3/P6)                         |
| PCX    | ✅ Full                   | ZSoft PCX (RLE compressed)                        |
| ASCII  | ✅ Full                   | Text-based ASCII art                              |
| JPEG   | ⚠️ Baseline & Progressive | Pure-JS baseline & basic progressive DCT          |
| WebP   | ⚠️ Lossless               | Pure-JS lossless VP8L                             |
| TIFF   | ⚠️ Basic                  | Pure-JS uncompressed, LZW, & grayscale            |
| HEIC   | 🔌 Runtime                | Requires ImageDecoder/OffscreenCanvas API support |
| AVIF   | 🔌 Runtime                | Requires ImageDecoder/OffscreenCanvas API support |

See the
[full format support documentation](https://cross-image.56k.guru/formats/) for
detailed compatibility information.

## JPEG Tolerant Decoding

The JPEG decoder includes a tolerant decoding mode (enabled by default) that
gracefully handles partially corrupted images or complex encoding patterns from
mobile phone cameras. When enabled, the decoder will continue processing even if
some blocks fail to decode, filling failed blocks with neutral values.

**Features:**

- **Enabled by default** - Handles real-world JPEGs from various devices
- **Progressive JPEG support** - Decodes both baseline and progressive JPEGs
- **Configurable** - Can be disabled for strict validation
- **Fault-tolerant** - Recovers partial image data instead of failing completely
- **Zero configuration** - Works automatically with the standard
  `Image.decode()` API

**When to use:**

- Mobile phone JPEGs with complex encoding patterns
- Progressive JPEG images from web sources
- Images from various camera manufacturers
- Partially corrupted JPEG files
- Production applications requiring maximum compatibility

**Example:**

```typescript
import { Image } from "@cross/image";

// Default behavior - tolerant mode enabled
const data = await Deno.readFile("mobile-photo.jpg");
const image = await Image.decode(data); // Automatically handles complex JPEGs

// For advanced users: explicitly control tolerant mode via pure JS decoder
import { JPEGDecoder } from "@cross/image/utils/jpeg_decoder";

// Enable tolerant decoding (default)
const tolerantDecoder = new JPEGDecoder(data, { tolerantDecoding: true });
const rgba1 = tolerantDecoder.decode();

// Disable for strict validation
const strictDecoder = new JPEGDecoder(data, { tolerantDecoding: false });
const rgba2 = strictDecoder.decode(); // Throws on any decoding error
```

**Note:** When using `Image.decode()`, the library automatically tries
runtime-optimized decoders (ImageDecoder API) first, falling back to the pure JS
decoder with tolerant mode for maximum compatibility.

## Fault-Tolerant Decoding for Other Formats

In addition to JPEG, @cross/image provides fault-tolerant decoding for several
other formats that commonly encounter corruption or complex encoding patterns:

### GIF Fault-Tolerant Decoding

The GIF decoder supports frame-level tolerance for animated GIFs. When enabled
(default), corrupted frames are skipped instead of causing complete decode
failure.

**Features:**

- **Enabled by default** - Handles multi-frame GIFs with some corrupted frames
- **Frame-level recovery** - Skips bad frames, preserves good ones
- **LZW decompression errors** - Continues past compression errors

**Example:**

```typescript
import { GIFDecoder } from "@cross/image/utils/gif_decoder";

// Tolerant mode (default) - skips corrupted frames
const tolerantDecoder = new GIFDecoder(data, { tolerantDecoding: true });
const result = tolerantDecoder.decodeAllFrames();

// Strict mode - throws on first corrupted frame
const strictDecoder = new GIFDecoder(data, { tolerantDecoding: false });
const strictResult = strictDecoder.decodeAllFrames();
```

### WebP Fault-Tolerant Decoding (VP8L Lossless)

The WebP VP8L (lossless) decoder supports pixel-level tolerance. When enabled
(default), decoding errors result in gray pixels for remaining data instead of
complete failure.

**Features:**

- **Enabled by default** - Handles VP8L images with Huffman/LZ77 errors
- **Pixel-level recovery** - Fills remaining pixels with neutral gray
- **Huffman decode errors** - Continues past invalid codes

**Example:**

```typescript
import { WebPDecoder } from "@cross/image/utils/webp_decoder";

// Tolerant mode (default) - fills bad pixels with gray
const tolerantDecoder = new WebPDecoder(data, { tolerantDecoding: true });
const result = tolerantDecoder.decode();

// Strict mode - throws on first decode error
const strictDecoder = new WebPDecoder(data, { tolerantDecoding: false });
const strictResult = strictDecoder.decode();
```

### When to Use Fault-Tolerant Modes

**Use tolerant decoding (default) when:**

- Processing user-uploaded images from various sources
- Building production applications requiring maximum compatibility
- Handling images from mobile devices or cameras
- Recovering data from partially corrupted files
- Batch processing where some failures are acceptable

**Use strict decoding when:**

- Validating image file integrity
- Quality control in professional workflows
- Detecting file corruption explicitly
- Testing image encoder implementations

## Metadata Support

@cross/image provides comprehensive EXIF 3.0 compliant metadata support for
image files, including camera information, GPS coordinates, and InteropIFD
compatibility markers.

### Supported Metadata Fields

**Basic Metadata:**

- `title`, `description`, `author`, `copyright`
- `creationDate` - Date/time image was created

**Camera Settings (JPEG, TIFF, WebP via XMP):**

- `cameraMake`, `cameraModel` - Camera manufacturer and model
- `lensMake`, `lensModel` - Lens information
- `iso` - ISO speed rating
- `exposureTime` - Shutter speed in seconds
- `fNumber` - Aperture (f-number)
- `focalLength` - Focal length in mm
- `flash`, `whiteBalance` - Capture settings
- `orientation` - Image orientation (1=normal, 3=180°, 6=90°CW, 8=90°CCW)
- `software` - Software used
- `userComment` - User notes

**GPS Coordinates (All EXIF formats: JPEG, PNG, WebP, TIFF):**

- `latitude`, `longitude` - GPS coordinates in decimal degrees
- Full microsecond precision with DMS (degrees-minutes-seconds) conversion

**DPI (JPEG, PNG, TIFF):**

- `dpiX`, `dpiY` - Dots per inch for printing

### EXIF 3.0 Specification Compliance

The library implements the EXIF 3.0 specification with:

- **50+ Exif Sub-IFD tags** for comprehensive camera metadata
- **30+ IFD0 tags** for image information
- **InteropIFD support** for format compatibility (R98/sRGB, R03/Adobe RGB,
  THM/thumbnail)
- **GPS IFD** with proper coordinate conversion
- All EXIF data types (BYTE, ASCII, SHORT, LONG, RATIONAL, etc.)

### Example Usage

```typescript
import { Image } from "@cross/image";

// Load an image
const data = await Deno.readFile("photo.jpg");
const image = await Image.decode(data);

// Set metadata
image.setMetadata({
  author: "Jane Photographer",
  copyright: "© 2024",
  cameraMake: "Canon",
  cameraModel: "EOS R5",
  iso: 800,
  exposureTime: 0.004, // 1/250s
  fNumber: 2.8,
  focalLength: 50,
});

// Set GPS coordinates
image.setPosition(40.7128, -74.0060); // NYC

// Check what metadata a format supports
const jpegSupports = Image.getSupportedMetadata("jpeg");
console.log(jpegSupports); // Includes ISO, camera info, GPS, etc.

// Save with metadata
const jpeg = await image.save("jpeg");
await Deno.writeFile("output.jpg", jpeg);

// Metadata is preserved on reload!
const loaded = await Image.decode(jpeg);
console.log(loaded.metadata?.cameraMake); // "Canon"
console.log(loaded.getPosition()); // { latitude: 40.7128, longitude: -74.0060 }
```

### Extracting Metadata Without Decoding

For quickly reading metadata from images without the overhead of decoding pixel
data, use `Image.extractMetadata()`. This is particularly useful for:

- Reading EXIF data from large images or photos
- Extracting metadata from images with unsupported compression
- Building image catalogs or galleries
- Processing metadata in batch operations

```typescript
import { Image } from "@cross/image";

// Extract metadata without decoding pixels
const data = await Deno.readFile("large-photo.jpg");
const metadata = await Image.extractMetadata(data);

console.log(metadata?.cameraMake); // "Canon"
console.log(metadata?.iso); // 800
console.log(metadata?.exposureTime); // 0.004

// Works with auto-detection
const metadata2 = await Image.extractMetadata(data); // Detects JPEG

// Or specify format explicitly
const metadata3 = await Image.extractMetadata(data, "jpeg");
```

This method is significantly faster than full decode when you only need
metadata, as it:

- Skips pixel data decompression
- Only parses metadata chunks/markers
- Returns `undefined` for unsupported formats
- Works with JPEG, PNG, WebP, TIFF, HEIC, and AVIF formats

### Format-Specific Support

Use `Image.getSupportedMetadata(format)` to check which fields are supported:

```typescript
Image.getSupportedMetadata("jpeg"); // Full camera metadata + GPS (21 fields)
Image.getSupportedMetadata("tiff"); // Comprehensive EXIF + GPS + InteropIFD (23+ fields)
Image.getSupportedMetadata("png"); // DateTime, GPS, DPI, basic text (9 fields)
Image.getSupportedMetadata("webp"); // Enhanced XMP + GPS (15 fields - includes camera metadata!)
Image.getSupportedMetadata("heic"); // Full camera metadata + GPS (19 fields)
Image.getSupportedMetadata("avif"); // Full camera metadata + GPS (19 fields)
```

**Format Highlights:**

- **JPEG**: Most comprehensive EXIF support, including all camera settings and
  GPS
- **TIFF**: Full EXIF 3.0 support with IFD structure, InteropIFD compatibility
- **WebP**: Enhanced XMP implementation with Dublin Core, EXIF, and TIFF
  namespaces
- **PNG**: Basic EXIF support via eXIf chunk plus GPS coordinates
- **HEIC**: Full EXIF metadata extraction including camera settings, GPS, and
  image info (runtime-dependent encoding)
- **AVIF**: Full EXIF metadata extraction including camera settings, GPS, and
  image info (runtime-dependent encoding)

## Documentation

- **[API Reference](https://cross-image.56k.guru/api/)** - Complete API
  documentation
- **[Format Support](https://cross-image.56k.guru/formats/)** - Supported
  formats and specifications
- **[Image Processing](https://cross-image.56k.guru/processing/)** - Filters,
  manipulation, and color adjustments
  - [Filters](https://cross-image.56k.guru/processing/filters/) - Blur, sharpen,
    and noise reduction
  - [Manipulation](https://cross-image.56k.guru/processing/manipulation/) -
    Resize, crop, composite, and draw
  - [Color Adjustments](https://cross-image.56k.guru/processing/color-adjustments/) -
    Brightness, contrast, saturation, and more
- **[Examples](https://cross-image.56k.guru/examples/)** - Practical examples
  for common tasks
  - [Decoding & Encoding](https://cross-image.56k.guru/examples/decoding-encoding/) -
    Format-specific examples
  - [Using Filters](https://cross-image.56k.guru/examples/filters/) - Filter
    workflows and techniques
  - [Manipulation](https://cross-image.56k.guru/examples/manipulation/) -
    Resizing, cropping, and compositing
  - [Multi-Frame Images](https://cross-image.56k.guru/examples/multi-frame/) -
    Animated GIFs, APNGs, and TIFFs
- **[JPEG Implementation](https://cross-image.56k.guru/implementation/jpeg-implementation/)** -
  Technical details for JPEG
- **[WebP Implementation](https://cross-image.56k.guru/implementation/webp-implementation/)** -
  Technical details for WebP
- **[TIFF Implementation](https://cross-image.56k.guru/implementation/tiff-implementation/)** -
  Technical details for TIFF

## Development

### Running Tests

```bash
deno test -A
```

### Linting and Formatting

```bash
deno fmt --check
deno lint
```

### Type Checking

```bash
deno check mod.ts
```

## License

MIT License - see LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
