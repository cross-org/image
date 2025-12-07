/**
 * @module @cross/image
 *
 * A pure JavaScript, dependency-free, cross-runtime image processing library.
 * Supports reading, resizing, and saving common image formats (PNG, JPEG, WebP, GIF, TIFF, BMP, RAW).
 *
 * @example
 * ```ts
 * import { Image } from "@cross/image";
 *
 * // Read an image
 * const data = await Deno.readFile("input.png");
 * const image = await Image.read(data);
 *
 * // Resize it
 * image.resize({ width: 200, height: 200 });
 *
 * // Save as different format
 * const output = await image.save("jpeg");
 * await Deno.writeFile("output.jpg", output);
 * ```
 */

export { Image } from "./src/image.ts";
export type {
  ASCIIOptions,
  ImageData,
  ImageFormat,
  ImageMetadata,
  ResizeOptions,
} from "./src/types.ts";
export { PNGFormat } from "./src/formats/png.ts";
export { JPEGFormat } from "./src/formats/jpeg.ts";
export { WebPFormat } from "./src/formats/webp.ts";
export { GIFFormat } from "./src/formats/gif.ts";
export { type TIFFEncodeOptions, TIFFFormat } from "./src/formats/tiff.ts";
export { BMPFormat } from "./src/formats/bmp.ts";
export { RAWFormat } from "./src/formats/raw.ts";
export { ASCIIFormat } from "./src/formats/ascii.ts";
