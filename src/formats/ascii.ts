import type {
  ASCIIOptions,
  ImageData,
  ImageFormat,
  ImageMetadata,
} from "../types.ts";
import { validateImageDimensions } from "../utils/security.ts";

/**
 * ASCII format handler
 * Converts images to ASCII art text representation
 *
 * Format structure:
 * - Magic bytes (6 bytes): "ASCII\n" (0x41 0x53 0x43 0x49 0x49 0x0A)
 * - Options line: "width:W charset:C aspectRatio:A invert:I\n"
 * - ASCII art text (UTF-8 encoded)
 *
 * Note: This format is primarily for encoding (image to ASCII).
 * Decoding reconstructs a basic grayscale approximation.
 */
export class ASCIIFormat implements ImageFormat {
  readonly name = "ascii";
  readonly mimeType = "text/plain";

  private readonly MAGIC_BYTES = new Uint8Array([
    0x41,
    0x53,
    0x43,
    0x49,
    0x49,
    0x0A,
  ]); // "ASCII\n"

  // Character sets ordered from darkest to lightest
  private readonly CHARSETS = {
    simple: " .:-=+*#%@",
    extended:
      " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
    blocks: " ░▒▓█",
    detailed:
      " .`-_':,;^=+/\"|)\\<>)iv%xclrs{*}I?!][1taeo7zjLunT#JCwfy325Fh9kP6pqdbVOlS8X$KHEA4D3RZG0MQNWU&%B@",
  };

  canDecode(data: Uint8Array): boolean {
    // Check if data starts with "ASCII\n"
    if (data.length < 6) {
      return false;
    }

    return data[0] === this.MAGIC_BYTES[0] &&
      data[1] === this.MAGIC_BYTES[1] &&
      data[2] === this.MAGIC_BYTES[2] &&
      data[3] === this.MAGIC_BYTES[3] &&
      data[4] === this.MAGIC_BYTES[4] &&
      data[5] === this.MAGIC_BYTES[5];
  }

  /**
   * Decode ASCII art to a basic grayscale RGBA image
   * @param data Raw ASCII art data
   * @returns Decoded image data with grayscale RGBA pixels
   */
  decode(data: Uint8Array): Promise<ImageData> {
    if (!this.canDecode(data)) {
      throw new Error("Invalid ASCII art signature");
    }

    // Convert to string
    const text = new TextDecoder().decode(data);
    const lines = text.split("\n");

    if (lines.length < 2) {
      throw new Error("Invalid ASCII art format");
    }

    // Parse options from second line
    const optionsLine = lines[1];
    const options = this.parseOptions(optionsLine);

    // Get ASCII art content (skip magic line and options line)
    const artLines = lines.slice(2).filter((line) => line.length > 0);

    if (artLines.length === 0) {
      throw new Error("No ASCII art content found");
    }

    // Calculate dimensions
    const height = artLines.length;
    const width = Math.max(...artLines.map((line) => line.length));

    // Validate dimensions for security (prevent integer overflow and heap exhaustion)
    validateImageDimensions(width, height);

    // Convert ASCII art back to image data
    const imageData = new Uint8Array(width * height * 4);
    const charset = this.CHARSETS[options.charset] || this.CHARSETS.simple;

    for (let y = 0; y < height; y++) {
      const line = artLines[y];
      for (let x = 0; x < width; x++) {
        const char = x < line.length ? line[x] : " ";
        const charIndex = charset.indexOf(char);

        // Calculate brightness (0-255)
        let brightness;
        if (charIndex === -1) {
          brightness = 0; // Unknown character = black
        } else {
          brightness = Math.floor(
            (charIndex / (charset.length - 1)) * 255,
          );
        }

        if (options.invert) {
          brightness = 255 - brightness;
        }

        const offset = (y * width + x) * 4;
        imageData[offset] = brightness; // R
        imageData[offset + 1] = brightness; // G
        imageData[offset + 2] = brightness; // B
        imageData[offset + 3] = 255; // A
      }
    }

    return Promise.resolve({ width, height, data: imageData });
  }

  /**
   * Encode RGBA image data to ASCII art
   * @param imageData Image data to encode
   * @param options Optional ASCII encoding options
   * @returns Encoded ASCII art as UTF-8 bytes
   */
  encode(
    imageData: ImageData,
    options: ASCIIOptions = {},
  ): Promise<Uint8Array> {
    const {
      width: targetWidth = 80,
      charset = "simple",
      aspectRatio = 0.5,
      invert = false,
    } = options;

    // Get character set
    const chars = this.CHARSETS[charset] || this.CHARSETS.simple;

    // Calculate target height based on aspect ratio
    const { width: imgWidth, height: imgHeight, data } = imageData;
    const targetHeight = Math.floor(
      (imgHeight / imgWidth) * targetWidth * aspectRatio,
    );

    // Build ASCII art
    const lines: string[] = [];

    for (let y = 0; y < targetHeight; y++) {
      let line = "";
      for (let x = 0; x < targetWidth; x++) {
        // Map to source pixel
        const srcX = Math.floor((x / targetWidth) * imgWidth);
        const srcY = Math.floor((y / targetHeight) * imgHeight);
        const offset = (srcY * imgWidth + srcX) * 4;

        // Calculate grayscale value
        const r = data[offset];
        const g = data[offset + 1];
        const b = data[offset + 2];
        const gray = Math.floor(0.299 * r + 0.587 * g + 0.114 * b);

        // Map to character
        const brightness = invert ? 255 - gray : gray;
        const charIndex = Math.floor(
          (brightness / 255) * (chars.length - 1),
        );
        line += chars[charIndex];
      }
      lines.push(line);
    }

    // Create output with magic bytes and options
    const optionsLine =
      `width:${targetWidth} charset:${charset} aspectRatio:${aspectRatio} invert:${invert}`;
    const content = `ASCII\n${optionsLine}\n${lines.join("\n")}`;

    return Promise.resolve(new TextEncoder().encode(content));
  }

  /**
   * Parse options from the options line
   */
  private parseOptions(line: string): {
    charset: "simple" | "extended" | "blocks" | "detailed";
    invert: boolean;
  } {
    const defaults = {
      charset: "simple" as const,
      invert: false,
    };

    if (!line) return defaults;

    const parts = line.split(" ");
    const options = { ...defaults };

    for (const part of parts) {
      const [key, value] = part.split(":");
      if (key === "charset" && value) {
        if (
          ["simple", "extended", "blocks", "detailed"].includes(value)
        ) {
          options.charset = value as typeof options.charset;
        }
      } else if (key === "invert" && value) {
        options.invert = value === "true";
      }
    }

    return options;
  }

  /**
   * Extract metadata from ASCII art data without fully decoding
   * @param data Raw ASCII art data
   * @returns Extracted metadata or undefined
   */
  extractMetadata(data: Uint8Array): Promise<ImageMetadata | undefined> {
    if (!this.canDecode(data)) {
      return Promise.resolve(undefined);
    }

    const metadata: ImageMetadata = {
      format: "ascii",
      compression: "none",
      frameCount: 1,
      bitDepth: 1, // ASCII is 1-bit (character or no character)
      colorType: "grayscale",
    };

    return Promise.resolve(metadata);
  }
}
