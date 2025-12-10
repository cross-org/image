/**
 * GPS IFD parsing and writing utilities
 *
 * This module provides utilities for reading and writing GPS coordinates
 * in EXIF GPS IFD format.
 */

import type { ImageMetadata } from "../../types.ts";
import { read32, readRational, write32, writeRational } from "./exif.ts";

/**
 * GPS IFD tag definitions
 */
export const GPS_TAGS = {
  GPS_VERSION_ID: 0x0000,
  GPS_LATITUDE_REF: 0x0001,
  GPS_LATITUDE: 0x0002,
  GPS_LONGITUDE_REF: 0x0003,
  GPS_LONGITUDE: 0x0004,
  GPS_ALTITUDE_REF: 0x0005,
  GPS_ALTITUDE: 0x0006,
  GPS_TIME_STAMP: 0x0007,
  GPS_DATE_STAMP: 0x001d,
} as const;

/**
 * Convert decimal degrees to degrees, minutes, seconds
 */
export function toDMS(decimal: number): {
  degrees: number;
  minutes: number;
  seconds: number;
} {
  const abs = Math.abs(decimal);
  const degrees = Math.floor(abs);
  const minutesDecimal = (abs - degrees) * 60;
  const minutes = Math.floor(minutesDecimal);
  const seconds = (minutesDecimal - minutes) * 60;

  return { degrees, minutes, seconds };
}

/**
 * Convert degrees, minutes, seconds to decimal degrees
 */
export function fromDMS(
  degrees: number,
  minutes: number,
  seconds: number,
): number {
  return degrees + minutes / 60 + seconds / 3600;
}

/**
 * Parse GPS IFD from EXIF data
 */
export function parseGPSIFD(
  exifData: Uint8Array,
  gpsIfdOffset: number,
  littleEndian: boolean,
): Partial<ImageMetadata> {
  const metadata: Partial<ImageMetadata> = {};

  try {
    const numEntries = littleEndian
      ? exifData[gpsIfdOffset] | (exifData[gpsIfdOffset + 1] << 8)
      : (exifData[gpsIfdOffset] << 8) | exifData[gpsIfdOffset + 1];

    let latitude: number | undefined;
    let longitude: number | undefined;
    let latRef: string | undefined;
    let lonRef: string | undefined;

    for (let i = 0; i < numEntries; i++) {
      const entryOffset = gpsIfdOffset + 2 + i * 12;
      if (entryOffset + 12 > exifData.length) break;

      const tag = littleEndian
        ? exifData[entryOffset] | (exifData[entryOffset + 1] << 8)
        : (exifData[entryOffset] << 8) | exifData[entryOffset + 1];

      const type = littleEndian
        ? exifData[entryOffset + 2] | (exifData[entryOffset + 3] << 8)
        : (exifData[entryOffset + 2] << 8) | exifData[entryOffset + 3];

      const valueOffset = read32(exifData, entryOffset + 8, littleEndian);

      // GPSLatitudeRef (0x0001) - 'N' or 'S'
      if (tag === GPS_TAGS.GPS_LATITUDE_REF && type === 2) {
        latRef = String.fromCharCode(exifData[entryOffset + 8]);
      }

      // GPSLatitude (0x0002) - three rationals: degrees, minutes, seconds
      if (
        tag === GPS_TAGS.GPS_LATITUDE && type === 5 &&
        valueOffset + 24 <= exifData.length
      ) {
        const degrees = readRational(exifData, valueOffset, littleEndian);
        const minutes = readRational(exifData, valueOffset + 8, littleEndian);
        const seconds = readRational(exifData, valueOffset + 16, littleEndian);
        latitude = fromDMS(degrees, minutes, seconds);
      }

      // GPSLongitudeRef (0x0003) - 'E' or 'W'
      if (tag === GPS_TAGS.GPS_LONGITUDE_REF && type === 2) {
        lonRef = String.fromCharCode(exifData[entryOffset + 8]);
      }

      // GPSLongitude (0x0004) - three rationals: degrees, minutes, seconds
      if (
        tag === GPS_TAGS.GPS_LONGITUDE && type === 5 &&
        valueOffset + 24 <= exifData.length
      ) {
        const degrees = readRational(exifData, valueOffset, littleEndian);
        const minutes = readRational(exifData, valueOffset + 8, littleEndian);
        const seconds = readRational(exifData, valueOffset + 16, littleEndian);
        longitude = fromDMS(degrees, minutes, seconds);
      }
    }

    // Apply hemisphere references
    if (latitude !== undefined && latRef) {
      metadata.latitude = latRef === "S" ? -latitude : latitude;
    }
    if (longitude !== undefined && lonRef) {
      metadata.longitude = lonRef === "W" ? -longitude : longitude;
    }
  } catch (_e) {
    // Ignore GPS parsing errors
  }

  return metadata;
}

/**
 * Create GPS IFD data
 */
export function createGPSIFD(
  latitude: number,
  longitude: number,
  gpsIfdStart: number,
  littleEndian = true,
): number[] {
  const gps: number[] = [];

  // We'll create 4 GPS entries: LatitudeRef, Latitude, LongitudeRef, Longitude
  const numEntries = 4;
  gps.push(numEntries & 0xff, (numEntries >> 8) & 0xff);

  // Convert to absolute values for DMS calculation
  const { degrees: latDeg, minutes: latMin, seconds: latSec } = toDMS(latitude);
  const { degrees: lonDeg, minutes: lonMin, seconds: lonSec } = toDMS(
    longitude,
  );

  // Calculate offset for rational data (relative to start of EXIF data, not GPS IFD)
  let dataOffset = gpsIfdStart + 2 + numEntries * 12 + 4;

  // Entry 1: GPSLatitudeRef (tag 0x0001)
  gps.push(0x01, 0x00); // Tag
  gps.push(0x02, 0x00); // Type (ASCII)
  write32(gps, 2, littleEndian); // Count (2 bytes including null)
  // Value stored inline: 'N' or 'S' + null
  gps.push(latitude >= 0 ? 78 : 83, 0x00, 0x00, 0x00); // 'N' = 78, 'S' = 83

  // Entry 2: GPSLatitude (tag 0x0002)
  gps.push(0x02, 0x00); // Tag
  gps.push(0x05, 0x00); // Type (RATIONAL)
  write32(gps, 3, littleEndian); // Count (3 rationals)
  write32(gps, dataOffset, littleEndian);
  dataOffset += 24; // 3 rationals * 8 bytes

  // Entry 3: GPSLongitudeRef (tag 0x0003)
  gps.push(0x03, 0x00); // Tag
  gps.push(0x02, 0x00); // Type (ASCII)
  write32(gps, 2, littleEndian); // Count
  gps.push(longitude >= 0 ? 69 : 87, 0x00, 0x00, 0x00); // 'E' = 69, 'W' = 87

  // Entry 4: GPSLongitude (tag 0x0004)
  gps.push(0x04, 0x00); // Tag
  gps.push(0x05, 0x00); // Type (RATIONAL)
  write32(gps, 3, littleEndian); // Count
  write32(gps, dataOffset, littleEndian);

  // Next IFD offset (0 = no more IFDs)
  write32(gps, 0, littleEndian);

  // Write latitude rationals
  writeRational(gps, latDeg, 1, littleEndian);
  writeRational(gps, latMin, 1, littleEndian);
  writeRational(gps, Math.round(latSec * 1000000), 1000000, littleEndian);

  // Write longitude rationals
  writeRational(gps, lonDeg, 1, littleEndian);
  writeRational(gps, lonMin, 1, littleEndian);
  writeRational(gps, Math.round(lonSec * 1000000), 1000000, littleEndian);

  return gps;
}
