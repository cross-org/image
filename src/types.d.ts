// Type declarations for browser/runtime APIs

// deno-lint-ignore-file no-explicit-any

declare global {
  class ImageDecoder {
    constructor(init: { data: Uint8Array; type: string });
    decode(): Promise<{ image: any }>;
  }

  class OffscreenCanvas {
    constructor(width: number, height: number);
    width: number;
    height: number;
    getContext(contextId: "2d"): OffscreenCanvasRenderingContext2D | null;
    convertToBlob(options?: { type?: string; quality?: number }): Promise<Blob>;
  }

  interface OffscreenCanvasRenderingContext2D {
    drawImage(image: any, dx: number, dy: number): void;
    getImageData(sx: number, sy: number, sw: number, sh: number): ImageData;
    createImageData(width: number, height: number): ImageData;
    putImageData(imageData: ImageData, dx: number, dy: number): void;
  }
}

export {};
