/**
 * EXIF metadata parsing and writing utilities
 *
 * This module provides utilities for reading and writing EXIF metadata in image files.
 * It supports IFD0 (main directory), Exif Sub-IFD, and GPS IFD.
 */

import type { ImageMetadata } from "../../types.ts";

/**
 * EXIF tag definitions for IFD0
 * Based on EXIF 3.0 specification and TIFF 6.0
 */
export const IFD0_TAGS = {
  // TIFF basic tags
  PROCESSING_SOFTWARE: 0x000b,
  SUBFILE_TYPE: 0x00fe,
  IMAGE_WIDTH: 0x0100,
  IMAGE_HEIGHT: 0x0101,
  IMAGE_DESCRIPTION: 0x010e,
  MAKE: 0x010f,
  MODEL: 0x0110,
  ORIENTATION: 0x0112,
  X_RESOLUTION: 0x011a,
  Y_RESOLUTION: 0x011b,
  RESOLUTION_UNIT: 0x0128,
  SOFTWARE: 0x0131,
  DATE_TIME: 0x0132,
  ARTIST: 0x013b,
  WHITE_POINT: 0x013e,
  PRIMARY_CHROMATICITIES: 0x013f,
  Y_CB_CR_COEFFICIENTS: 0x0211,
  Y_CB_CR_POSITIONING: 0x0213,
  REFERENCE_BLACK_WHITE: 0x0214,
  COPYRIGHT: 0x8298,
  // EXIF IFD pointers
  EXIF_IFD_POINTER: 0x8769,
  GPS_IFD_POINTER: 0x8825,
  INTEROP_IFD_POINTER: 0xa005,
} as const;

/**
 * EXIF tag definitions for Exif Sub-IFD
 * Based on EXIF 3.0 specification
 */
export const EXIF_SUB_IFD_TAGS = {
  // EXIF version and identification
  EXIF_VERSION: 0x9000,
  FLASHPIX_VERSION: 0xa000,
  COLOR_SPACE: 0xa001,
  // Image configuration
  COMPONENTS_CONFIGURATION: 0x9101,
  COMPRESSED_BITS_PER_PIXEL: 0x9102,
  PIXEL_X_DIMENSION: 0xa002,
  PIXEL_Y_DIMENSION: 0xa003,
  // User information
  MAKER_NOTE: 0x927c,
  USER_COMMENT: 0x9286,
  // Date and time
  DATE_TIME_ORIGINAL: 0x9003,
  DATE_TIME_DIGITIZED: 0x9004,
  SUB_SEC_TIME: 0x9290,
  SUB_SEC_TIME_ORIGINAL: 0x9291,
  SUB_SEC_TIME_DIGITIZED: 0x9292,
  // Picture taking conditions
  EXPOSURE_TIME: 0x829a,
  F_NUMBER: 0x829d,
  EXPOSURE_PROGRAM: 0x8822,
  SPECTRAL_SENSITIVITY: 0x8824,
  ISO_SPEED_RATINGS: 0x8827,
  OECF: 0x8828,
  SENSITIVITY_TYPE: 0x8830,
  STANDARD_OUTPUT_SENSITIVITY: 0x8831,
  RECOMMENDED_EXPOSURE_INDEX: 0x8832,
  ISO_SPEED: 0x8833,
  ISO_SPEED_LATITUDE_YYY: 0x8834,
  ISO_SPEED_LATITUDE_ZZZ: 0x8835,
  SHUTTER_SPEED_VALUE: 0x9201,
  APERTURE_VALUE: 0x9202,
  BRIGHTNESS_VALUE: 0x9203,
  EXPOSURE_BIAS_VALUE: 0x9204,
  MAX_APERTURE_VALUE: 0x9205,
  SUBJECT_DISTANCE: 0x9206,
  METERING_MODE: 0x9207,
  LIGHT_SOURCE: 0x9208,
  FLASH: 0x9209,
  FOCAL_LENGTH: 0x920a,
  SUBJECT_AREA: 0x9214,
  // Image characteristics
  FILE_SOURCE: 0xa300,
  SCENE_TYPE: 0xa301,
  CFA_PATTERN: 0xa302,
  CUSTOM_RENDERED: 0xa401,
  EXPOSURE_MODE: 0xa402,
  WHITE_BALANCE: 0xa403,
  DIGITAL_ZOOM_RATIO: 0xa404,
  FOCAL_LENGTH_IN_35MM_FILM: 0xa405,
  SCENE_CAPTURE_TYPE: 0xa406,
  GAIN_CONTROL: 0xa407,
  CONTRAST: 0xa408,
  SATURATION: 0xa409,
  SHARPNESS: 0xa40a,
  DEVICE_SETTING_DESCRIPTION: 0xa40b,
  SUBJECT_DISTANCE_RANGE: 0xa40c,
  // Other tags
  IMAGE_UNIQUE_ID: 0xa420,
  CAMERA_OWNER_NAME: 0xa430,
  BODY_SERIAL_NUMBER: 0xa431,
  LENS_SPECIFICATION: 0xa432,
  LENS_MAKE: 0xa433,
  LENS_MODEL: 0xa434,
  LENS_SERIAL_NUMBER: 0xa435,
  GAMMA: 0xa500,
} as const;

/**
 * Interoperability IFD tag definitions
 * Used for compatibility between different image systems
 */
export const INTEROP_IFD_TAGS = {
  INTEROP_INDEX: 0x0001,
  INTEROP_VERSION: 0x0002,
  RELATED_IMAGE_FILE_FORMAT: 0x1000,
  RELATED_IMAGE_WIDTH: 0x1001,
  RELATED_IMAGE_HEIGHT: 0x1002,
} as const;

/**
 * EXIF data type definitions
 * Based on TIFF 6.0 and EXIF 3.0 specifications
 */
export const EXIF_TYPES = {
  BYTE: 1, // 8-bit unsigned integer
  ASCII: 2, // 8-bit byte containing 7-bit ASCII code
  SHORT: 3, // 16-bit unsigned integer
  LONG: 4, // 32-bit unsigned integer
  RATIONAL: 5, // Two LONGs: numerator and denominator
  SBYTE: 6, // 8-bit signed integer
  UNDEFINED: 7, // 8-bit byte that may take any value
  SSHORT: 8, // 16-bit signed integer
  SLONG: 9, // 32-bit signed integer
  SRATIONAL: 10, // Two SLONGs: numerator and denominator
  FLOAT: 11, // 32-bit IEEE floating point
  DOUBLE: 12, // 64-bit IEEE floating point
} as const;

/**
 * Interoperability index values
 */
export const INTEROP_INDEX = {
  R98: "R98", // DCF basic file (sRGB)
  R03: "R03", // DCF option file (Adobe RGB)
  THM: "THM", // DCF thumbnail file
} as const;

/**
 * EXIF version constants
 */
export const EXIF_VERSION = {
  V2_2: "0220", // EXIF 2.2
  V2_21: "0221", // EXIF 2.21
  V2_3: "0230", // EXIF 2.3
  V3_0: "0300", // EXIF 3.0 (current)
} as const;

/**
 * Read a 16-bit value from a buffer
 */
export function read16(
  data: Uint8Array,
  offset: number,
  littleEndian: boolean,
): number {
  return littleEndian
    ? data[offset] | (data[offset + 1] << 8)
    : (data[offset] << 8) | data[offset + 1];
}

/**
 * Read a 32-bit value from a buffer
 */
export function read32(
  data: Uint8Array,
  offset: number,
  littleEndian: boolean,
): number {
  return littleEndian
    ? data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) |
      (data[offset + 3] << 24)
    : (data[offset] << 24) | (data[offset + 1] << 16) |
      (data[offset + 2] << 8) | data[offset + 3];
}

/**
 * Read a rational value (numerator/denominator) from a buffer
 */
export function readRational(
  data: Uint8Array,
  offset: number,
  littleEndian: boolean,
): number {
  const numerator = read32(data, offset, littleEndian);
  const denominator = read32(data, offset + 4, littleEndian);
  return denominator !== 0 ? numerator / denominator : 0;
}

/**
 * Write a 16-bit value to an array
 */
export function write16(
  output: number[],
  value: number,
  littleEndian = true,
): void {
  if (littleEndian) {
    output.push(value & 0xff, (value >> 8) & 0xff);
  } else {
    output.push((value >> 8) & 0xff, value & 0xff);
  }
}

/**
 * Write a 32-bit value to an array
 */
export function write32(
  output: number[],
  value: number,
  littleEndian = true,
): void {
  if (littleEndian) {
    output.push(
      value & 0xff,
      (value >> 8) & 0xff,
      (value >> 16) & 0xff,
      (value >> 24) & 0xff,
    );
  } else {
    output.push(
      (value >> 24) & 0xff,
      (value >> 16) & 0xff,
      (value >> 8) & 0xff,
      value & 0xff,
    );
  }
}

/**
 * Write a rational value (numerator/denominator) to an array
 */
export function writeRational(
  output: number[],
  numerator: number,
  denominator: number,
  littleEndian = true,
): void {
  write32(output, numerator, littleEndian);
  write32(output, denominator, littleEndian);
}

/**
 * Convert a decimal value to a rational representation
 */
export function toRational(value: number): [number, number] {
  const denominators = [1, 10, 100, 1000, 10000, 100000, 1000000];
  for (const den of denominators) {
    const num = Math.round(value * den);
    if (Math.abs(num / den - value) < 0.000001) {
      return [num, den];
    }
  }
  return [Math.round(value * 1000000), 1000000];
}

/**
 * Read a null-terminated ASCII string from a buffer
 */
export function readASCII(
  data: Uint8Array,
  offset: number,
  maxLength?: number,
): string {
  const endIndex = maxLength
    ? Math.min(data.indexOf(0, offset), offset + maxLength)
    : data.indexOf(0, offset);
  if (endIndex > offset) {
    return new TextDecoder().decode(data.slice(offset, endIndex));
  }
  return "";
}

/**
 * Format a Date object as EXIF DateTime string
 */
export function formatEXIFDate(date: Date): string {
  return `${date.getFullYear()}:${String(date.getMonth() + 1).padStart(2, "0")}:${
    String(date.getDate()).padStart(2, "0")
  } ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${
    String(date.getSeconds()).padStart(2, "0")
  }\0`;
}

/**
 * Parse an EXIF DateTime string
 */
export function parseEXIFDate(dateStr: string): Date | undefined {
  try {
    const match = dateStr.match(
      /(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/,
    );
    if (match) {
      return new Date(
        parseInt(match[1]),
        parseInt(match[2]) - 1,
        parseInt(match[3]),
        parseInt(match[4]),
        parseInt(match[5]),
        parseInt(match[6]),
      );
    }
  } catch (_e) {
    // Ignore parse errors
  }
  return undefined;
}

/**
 * Supported EXIF metadata fields for different IFDs
 */
export interface EXIFSupportedFields {
  ifd0: Array<keyof ImageMetadata>;
  exifSubIFD: Array<keyof ImageMetadata>;
  gpsIFD: Array<keyof ImageMetadata>;
  interopIFD: string[]; // InteropIFD doesn't map to ImageMetadata directly
}

/**
 * Get list of supported EXIF metadata fields
 */
export function getSupportedEXIFFields(): EXIFSupportedFields {
  return {
    ifd0: [
      "creationDate",
      "description",
      "author",
      "copyright",
      "cameraMake",
      "cameraModel",
      "orientation",
      "software",
    ],
    exifSubIFD: [
      "iso",
      "exposureTime",
      "fNumber",
      "focalLength",
      "flash",
      "whiteBalance",
      "lensMake",
      "lensModel",
      "userComment",
    ],
    gpsIFD: ["latitude", "longitude"],
    interopIFD: ["InteropIndex", "InteropVersion"], // Special fields for format compatibility
  };
}

/**
 * Create an InteropIFD for EXIF 3.0 compliance
 * Returns the IFD data to be written
 */
export function createInteropIFD(
  interopIndex: string = INTEROP_INDEX.R98,
  littleEndian = true,
): number[] {
  const ifd: number[] = [];

  // Number of directory entries
  write16(ifd, 2, littleEndian); // 2 tags: InteropIndex and InteropVersion

  // InteropIndex tag (0x0001)
  write16(ifd, INTEROP_IFD_TAGS.INTEROP_INDEX, littleEndian); // Tag
  write16(ifd, EXIF_TYPES.ASCII, littleEndian); // Type
  write32(ifd, interopIndex.length + 1, littleEndian); // Count (including null terminator)
  // Value (inline if <= 4 bytes, otherwise offset)
  const indexBytes = new TextEncoder().encode(interopIndex + "\0");
  for (let i = 0; i < 4; i++) {
    ifd.push(indexBytes[i] || 0);
  }

  // InteropVersion tag (0x0002)
  write16(ifd, INTEROP_IFD_TAGS.INTEROP_VERSION, littleEndian); // Tag
  write16(ifd, EXIF_TYPES.UNDEFINED, littleEndian); // Type
  write32(ifd, 4, littleEndian); // Count
  // Value: "0100" for version 1.0
  ifd.push(0x30, 0x31, 0x30, 0x30);

  // Next IFD offset (0 = no next IFD)
  write32(ifd, 0, littleEndian);

  return ifd;
}

/**
 * Parse InteropIFD from EXIF data
 * Returns the interoperability index (R98, R03, THM, or null if not found)
 */
export function parseInteropIFD(
  data: Uint8Array,
  offset: number,
  littleEndian: boolean,
): string | null {
  try {
    // Read number of directory entries
    const numEntries = read16(data, offset, littleEndian);

    // Parse directory entries
    for (let i = 0; i < numEntries; i++) {
      const entryOffset = offset + 2 + i * 12;
      const tag = read16(data, entryOffset, littleEndian);

      if (tag === INTEROP_IFD_TAGS.INTEROP_INDEX) {
        const type = read16(data, entryOffset + 2, littleEndian);
        const count = read32(data, entryOffset + 4, littleEndian);

        if (type === EXIF_TYPES.ASCII) {
          // Value is stored inline if <= 4 bytes
          const valueOffset = entryOffset + 8;
          return readASCII(data, valueOffset, Math.min(count, 4));
        }
      }
    }
  } catch (_e) {
    // Ignore errors and return null
  }
  return null;
}
