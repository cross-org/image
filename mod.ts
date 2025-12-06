/**
 * @module @cross/image
 *
 * A pure JavaScript, dependency-free, cross-runtime image processing library.
 * Supports reading, resizing, and saving common image formats (PNG, JPEG, WebP).
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
  ImageData,
  ImageFormat,
  ImageMetadata,
  ResizeOptions,
} from "./src/types.ts";
export { PNGFormat } from "./src/formats/png.ts";
export { JPEGFormat } from "./src/formats/jpeg.ts";
export { WebPFormat } from "./src/formats/webp.ts";
