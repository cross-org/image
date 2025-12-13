/**
 * Shared byte-level read/write utilities for image formats
 * These functions handle reading and writing multi-byte integers
 * in little-endian byte order, commonly used in BMP, ICO, GIF, and other formats.
 */

// Constants for signed/unsigned integer conversion
const INT32_MAX = 0x7fffffff;
const UINT32_RANGE = 0x100000000;

/**
 * Read a 16-bit unsigned integer in little-endian format
 */
export function readUint16LE(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8);
}

/**
 * Read a 32-bit unsigned integer in little-endian format
 */
export function readUint32LE(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8) |
    (data[offset + 2] << 16) | (data[offset + 3] << 24);
}

/**
 * Read a 32-bit signed integer in little-endian format
 */
export function readInt32LE(data: Uint8Array, offset: number): number {
  const value = readUint32LE(data, offset);
  return value > INT32_MAX ? value - UINT32_RANGE : value;
}

/**
 * Write a 16-bit unsigned integer in little-endian format
 */
export function writeUint16LE(
  data: Uint8Array,
  offset: number,
  value: number,
): void {
  data[offset] = value & 0xff;
  data[offset + 1] = (value >>> 8) & 0xff;
}

/**
 * Write a 32-bit unsigned integer in little-endian format
 */
export function writeUint32LE(
  data: Uint8Array,
  offset: number,
  value: number,
): void {
  data[offset] = value & 0xff;
  data[offset + 1] = (value >>> 8) & 0xff;
  data[offset + 2] = (value >>> 16) & 0xff;
  data[offset + 3] = (value >>> 24) & 0xff;
}

/**
 * Write a 32-bit signed integer in little-endian format
 */
export function writeInt32LE(
  data: Uint8Array,
  offset: number,
  value: number,
): void {
  writeUint32LE(data, offset, value < 0 ? value + UINT32_RANGE : value);
}

/**
 * Clamp a value to the range [0, 255] for RGB channel values
 * @param value Value to clamp
 * @returns Clamped value in range [0, 255]
 */
export function clampRgb(value: number): number {
  return Math.max(0, Math.min(255, value));
}

/**
 * Clamp a value to a specified range [min, max]
 * @param value Value to clamp
 * @param min Minimum value
 * @param max Maximum value
 * @returns Clamped value in range [min, max]
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
