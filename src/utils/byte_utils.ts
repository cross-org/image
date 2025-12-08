/**
 * Shared byte-level read/write utilities for image formats
 * These functions handle reading and writing multi-byte integers
 * in little-endian byte order, commonly used in BMP, ICO, GIF, and other formats.
 */

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
  return value > 0x7fffffff ? value - 0x100000000 : value;
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
  writeUint32LE(data, offset, value < 0 ? value + 0x100000000 : value);
}
