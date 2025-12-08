import type { ImageData, ImageFormat } from "../types.ts";

/**
 * PCX format handler
 * Implements PCX decoder and encoder
 */
export class PCXFormat implements ImageFormat {
  readonly name = "pcx";
  readonly mimeType = "image/x-pcx";

  canDecode(data: Uint8Array): boolean {
    // PCX header check
    // Byte 0: Manufacturer (must be 0x0A)
    // Byte 1: Version (0, 2, 3, 4, 5)
    // Byte 2: Encoding (1 = RLE)
    return data.length >= 128 &&
      data[0] === 0x0A &&
      (data[1] === 0 || data[1] === 2 || data[1] === 3 || data[1] === 4 ||
        data[1] === 5) &&
      data[2] === 1;
  }

  decode(data: Uint8Array): Promise<ImageData> {
    if (!this.canDecode(data)) {
      return Promise.reject(new Error("Invalid PCX data"));
    }

    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

    // Parse header
    // const manufacturer = view.getUint8(0);
    // const version = view.getUint8(1);
    // const encoding = view.getUint8(2);
    const bitsPerPixel = view.getUint8(3);
    const xMin = view.getUint16(4, true);
    const yMin = view.getUint16(6, true);
    const xMax = view.getUint16(8, true);
    const yMax = view.getUint16(10, true);
    // const hDpi = view.getUint16(12, true);
    // const vDpi = view.getUint16(14, true);
    // const colormap = data.slice(16, 64);
    // const reserved = view.getUint8(64);
    const nPlanes = view.getUint8(65);
    const bytesPerLine = view.getUint16(66, true);
    // const paletteInfo = view.getUint16(68, true);
    // const hScreenSize = view.getUint16(70, true);
    // const vScreenSize = view.getUint16(72, true);

    const width = xMax - xMin + 1;
    const height = yMax - yMin + 1;

    if (width <= 0 || height <= 0) {
      return Promise.reject(new Error("Invalid PCX dimensions"));
    }

    // Decode RLE data
    let offset = 128;
    const scanlineLength = nPlanes * bytesPerLine;
    const rawData = new Uint8Array(height * scanlineLength);
    let ptr = 0;

    // Decode all scanlines
    for (let y = 0; y < height; y++) {
      let x = 0;
      while (x < scanlineLength) {
        if (offset >= data.length) break;
        let byte = data[offset++];
        let count = 1;
        if ((byte & 0xC0) === 0xC0) {
          count = byte & 0x3F;
          if (offset >= data.length) break;
          byte = data[offset++];
        }
        for (let i = 0; i < count; i++) {
          if (ptr < rawData.length) {
            rawData[ptr++] = byte;
          }
          x++;
        }
      }
    }

    const rgba = new Uint8Array(width * height * 4);

    if (nPlanes === 3 && bitsPerPixel === 8) {
      // 24-bit RGB
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const r = rawData[y * scanlineLength + x];
          const g = rawData[y * scanlineLength + bytesPerLine + x];
          const b = rawData[y * scanlineLength + 2 * bytesPerLine + x];
          const idx = (y * width + x) * 4;
          rgba[idx] = r;
          rgba[idx + 1] = g;
          rgba[idx + 2] = b;
          rgba[idx + 3] = 255;
        }
      }
    } else if (nPlanes === 1 && bitsPerPixel === 8) {
      // 8-bit palette
      // Check for palette at end of file
      let palette: Uint8Array;
      if (data[data.length - 769] === 0x0C) {
        palette = data.slice(data.length - 768);
      } else {
        // Fallback or error?
        // Some old PCX might use header palette but that's only 16 colors.
        // For 8bpp we expect 256 color palette at end.
        return Promise.reject(new Error("Missing PCX palette"));
      }

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const colorIndex = rawData[y * scanlineLength + x];
          const idx = (y * width + x) * 4;
          rgba[idx] = palette[colorIndex * 3];
          rgba[idx + 1] = palette[colorIndex * 3 + 1];
          rgba[idx + 2] = palette[colorIndex * 3 + 2];
          rgba[idx + 3] = 255;
        }
      }
    } else {
      // Unsupported PCX format (e.g. 1-bit, 4-bit)
      // For now only supporting 24-bit and 8-bit
      return Promise.reject(new Error("Unsupported PCX format"));
    }

    return Promise.resolve({
      width,
      height,
      data: rgba,
    });
  }

  encode(image: ImageData): Promise<Uint8Array> {
    const width = image.width;
    const height = image.height;
    const data = image.data;

    // We will encode as 24-bit RGB (3 planes)
    const header = new Uint8Array(128);
    const view = new DataView(header.buffer);

    view.setUint8(0, 0x0A); // Manufacturer
    view.setUint8(1, 5); // Version 3.0+
    view.setUint8(2, 1); // Encoding RLE
    view.setUint8(3, 8); // Bits per pixel (8 per plane)
    view.setUint16(4, 0, true); // XMin
    view.setUint16(6, 0, true); // YMin
    view.setUint16(8, width - 1, true); // XMax
    view.setUint16(10, height - 1, true); // YMax
    view.setUint16(12, 72, true); // HDpi
    view.setUint16(14, 72, true); // VDpi
    view.setUint8(65, 3); // NPlanes (3 for RGB)
    view.setUint16(66, width + (width % 2), true); // BytesPerLine (must be even)
    view.setUint16(68, 1, true); // PaletteInfo (Color/BW)

    const bytesPerLine = width + (width % 2);
    const _scanlineLength = bytesPerLine * 3;
    const rleData: number[] = [];

    // Helper to write RLE
    const writeRLE = (byte: number, count: number) => {
      if ((byte & 0xC0) === 0xC0 || count > 1) {
        rleData.push(0xC0 | count);
        rleData.push(byte);
      } else {
        rleData.push(byte);
      }
    };

    for (let y = 0; y < height; y++) {
      // Prepare scanline planes
      const lineR = new Uint8Array(bytesPerLine);
      const lineG = new Uint8Array(bytesPerLine);
      const lineB = new Uint8Array(bytesPerLine);

      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        lineR[x] = data[idx];
        lineG[x] = data[idx + 1];
        lineB[x] = data[idx + 2];
      }

      // Compress each plane
      for (const plane of [lineR, lineG, lineB]) {
        let currentByte = plane[0];
        let runLength = 1;

        for (let x = 1; x < bytesPerLine; x++) {
          const byte = plane[x];
          if (byte === currentByte && runLength < 63) {
            runLength++;
          } else {
            writeRLE(currentByte, runLength);
            currentByte = byte;
            runLength = 1;
          }
        }
        writeRLE(currentByte, runLength);
      }
    }

    const result = new Uint8Array(header.length + rleData.length);
    result.set(header);
    result.set(rleData, header.length);

    return Promise.resolve(result);
  }
}
