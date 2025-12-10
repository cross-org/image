/**
 * EXIF metadata parsing and writing utilities
 *
 * This module provides utilities for reading and writing EXIF metadata in image files.
 * It supports IFD0 (main directory), Exif Sub-IFD, and GPS IFD.
 */

import type { ImageMetadata } from "../../types.ts";

/**
 * EXIF tag definitions for IFD0
 */
export const IFD0_TAGS = {
  MAKE: 0x010f,
  MODEL: 0x0110,
  ORIENTATION: 0x0112,
  SOFTWARE: 0x0131,
  DATE_TIME: 0x0132,
  IMAGE_DESCRIPTION: 0x010e,
  ARTIST: 0x013b,
  COPYRIGHT: 0x8298,
  EXIF_IFD_POINTER: 0x8769,
  GPS_IFD_POINTER: 0x8825,
} as const;

/**
 * EXIF tag definitions for Exif Sub-IFD
 */
export const EXIF_SUB_IFD_TAGS = {
  EXPOSURE_TIME: 0x829a,
  F_NUMBER: 0x829d,
  ISO_SPEED_RATINGS: 0x8827,
  FOCAL_LENGTH: 0x920a,
  USER_COMMENT: 0x9286,
  FLASH: 0x9209,
  WHITE_BALANCE: 0xa403,
  LENS_MAKE: 0xa433,
  LENS_MODEL: 0xa434,
} as const;

/**
 * EXIF data type definitions
 */
export const EXIF_TYPES = {
  BYTE: 1,
  ASCII: 2,
  SHORT: 3,
  LONG: 4,
  RATIONAL: 5,
  UNDEFINED: 7,
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
  return `${date.getFullYear()}:${
    String(date.getMonth() + 1).padStart(2, "0")
  }:${String(date.getDate()).padStart(2, "0")} ${
    String(date.getHours()).padStart(2, "0")
  }:${String(date.getMinutes()).padStart(2, "0")}:${
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
  };
}
