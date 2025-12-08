/**
 * @module @cross/image
 *
 * A pure JavaScript, dependency-free, cross-runtime image processing library.
 * Supports decoding, resizing, and encoding common image formats (PNG, JPEG, WebP, GIF, TIFF, BMP, RAW).
 *
 * @example
 * ```ts
 * import { Image } from "@cross/image";
 *
 * // Decode an image
 * const data = await Deno.readFile("input.png");
 * const image = await Image.decode(data);
 *
 * // Resize it
 * image.resize({ width: 200, height: 200 });
 *
 * // Encode as different format
 * const output = await image.encode("jpeg");
 * await Deno.writeFile("output.jpg", output);
 * ```
 */

export { Image } from "./src/image.ts";
export type {
  ASCIIOptions,
  FrameMetadata,
  ImageData,
  ImageFormat,
  ImageFrame,
  ImageMetadata,
  MultiFrameImageData,
  ResizeOptions,
  WebPEncodeOptions,
} from "./src/types.ts";
export { PNGFormat } from "./src/formats/png.ts";
export { JPEGFormat } from "./src/formats/jpeg.ts";
export { WebPFormat } from "./src/formats/webp.ts";
export { GIFFormat } from "./src/formats/gif.ts";
export { type TIFFEncodeOptions, TIFFFormat } from "./src/formats/tiff.ts";
export { BMPFormat } from "./src/formats/bmp.ts";
export { RAWFormat } from "./src/formats/raw.ts";
export { ASCIIFormat } from "./src/formats/ascii.ts";
