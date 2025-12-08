/**
 * Security utilities for image processing
 * Prevents integer overflow, heap exhaustion, and decompression bombs
 */

/**
 * Maximum safe image dimensions
 * These limits prevent integer overflow and heap exhaustion attacks
 */
export const MAX_IMAGE_DIMENSION = 65535; // 2^16 - 1 (reasonable for most use cases)
export const MAX_IMAGE_PIXELS = 178956970; // ~179 megapixels (fits safely in memory)

/**
 * Validates image dimensions to prevent security vulnerabilities
 *
 * @param width Image width in pixels
 * @param height Image height in pixels
 * @throws Error if dimensions are invalid or unsafe
 */
export function validateImageDimensions(width: number, height: number): void {
  // Check for negative or zero dimensions
  if (width <= 0 || height <= 0) {
    throw new Error(
      `Invalid image dimensions: ${width}x${height} (dimensions must be positive)`,
    );
  }

  // Check if dimensions are integers
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    throw new Error(
      `Invalid image dimensions: ${width}x${height} (dimensions must be integers)`,
    );
  }

  // Check individual dimension limits
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    throw new Error(
      `Image dimensions too large: ${width}x${height} (maximum ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION})`,
    );
  }

  // Check total pixel count to prevent excessive memory allocation
  const pixelCount = width * height;
  if (pixelCount > MAX_IMAGE_PIXELS) {
    throw new Error(
      `Image size too large: ${width}x${height} (${pixelCount} pixels exceeds maximum ${MAX_IMAGE_PIXELS})`,
    );
  }
}

/**
 * Safely calculates buffer size for RGBA image data
 *
 * @param width Image width in pixels
 * @param height Image height in pixels
 * @returns Buffer size in bytes (width * height * 4)
 * @throws Error if calculation would overflow
 */
export function calculateBufferSize(
  width: number,
  height: number,
): number {
  validateImageDimensions(width, height);
  return width * height * 4;
}
