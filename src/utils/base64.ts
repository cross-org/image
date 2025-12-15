/**
 * Base64 utilities.
 *
 * Designed to work across Deno, Node.js, and Bun without external dependencies.
 */

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const DECODE_TABLE = (() => {
  const table = new Uint8Array(256);
  table.fill(0xff);
  for (let i = 0; i < BASE64_ALPHABET.length; i++) {
    table[BASE64_ALPHABET.charCodeAt(i)] = i;
  }
  return table;
})();

function stripWhitespace(input: string): string {
  // Avoid regex to keep this fast and allocation-light.
  let out = "";
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    // Space, tab, CR, LF
    if (code === 0x20 || code === 0x09 || code === 0x0d || code === 0x0a) continue;
    out += input[i];
  }
  return out;
}

function normalizeBase64(input: string): string {
  // Accept URL-safe alphabet in decode paths.
  let s = stripWhitespace(input.trim());
  if (s.length === 0) return s;

  // Map base64url to base64.
  if (s.includes("-") || s.includes("_")) {
    s = s.replaceAll("-", "+").replaceAll("_", "/");
  }

  const remainder = s.length % 4;
  if (remainder === 1) {
    throw new Error("Invalid base64: length must not be 1 (mod 4)");
  }
  if (remainder === 2) s += "==";
  if (remainder === 3) s += "=";

  return s;
}

/**
 * Encode bytes into a standard Base64 string.
 */
export function encodeBase64(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";

  const outLen = Math.ceil(bytes.length / 3) * 4;
  const out = new Array<string>(outLen);

  let i = 0;
  let o = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out[o++] = BASE64_ALPHABET[(n >> 18) & 63];
    out[o++] = BASE64_ALPHABET[(n >> 12) & 63];
    out[o++] = BASE64_ALPHABET[(n >> 6) & 63];
    out[o++] = BASE64_ALPHABET[n & 63];
  }

  const remaining = bytes.length - i;
  if (remaining === 1) {
    const n = bytes[i] << 16;
    out[o++] = BASE64_ALPHABET[(n >> 18) & 63];
    out[o++] = BASE64_ALPHABET[(n >> 12) & 63];
    out[o++] = "=";
    out[o++] = "=";
  } else if (remaining === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out[o++] = BASE64_ALPHABET[(n >> 18) & 63];
    out[o++] = BASE64_ALPHABET[(n >> 12) & 63];
    out[o++] = BASE64_ALPHABET[(n >> 6) & 63];
    out[o++] = "=";
  }

  return out.join("");
}

/**
 * Decode a Base64 (or Base64URL) string into bytes.
 *
 * - Whitespace is ignored.
 * - Missing padding is tolerated.
 * - `-`/`_` are accepted as URL-safe variants.
 */
export function decodeBase64(base64: string): Uint8Array {
  const s = normalizeBase64(base64);
  if (s.length === 0) return new Uint8Array(0);

  let padding = 0;
  if (s.endsWith("==")) padding = 2;
  else if (s.endsWith("=")) padding = 1;

  const quadCount = s.length / 4;
  const outLen = quadCount * 3 - padding;
  const out = new Uint8Array(outLen);

  let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    const c0 = s.charCodeAt(i);
    const c1 = s.charCodeAt(i + 1);
    const c2 = s.charCodeAt(i + 2);
    const c3 = s.charCodeAt(i + 3);

    const v0 = DECODE_TABLE[c0];
    const v1 = DECODE_TABLE[c1];

    if (v0 === 0xff || v1 === 0xff) {
      throw new Error("Invalid base64: invalid character");
    }

    const isPad2 = c2 === 0x3d; // '='
    const isPad3 = c3 === 0x3d;

    const v2 = isPad2 ? 0 : DECODE_TABLE[c2];
    const v3 = isPad3 ? 0 : DECODE_TABLE[c3];

    if ((!isPad2 && v2 === 0xff) || (!isPad3 && v3 === 0xff)) {
      throw new Error("Invalid base64: invalid character");
    }

    const n = (v0 << 18) | (v1 << 12) | (v2 << 6) | v3;

    out[o++] = (n >> 16) & 0xff;
    if (!isPad2) {
      if (o >= out.length) break;
      out[o++] = (n >> 8) & 0xff;
    }
    if (!isPad3) {
      if (o >= out.length) break;
      out[o++] = n & 0xff;
    }

    if (isPad2 || isPad3) {
      // Padding is only valid in the final quartet.
      if (i + 4 !== s.length) {
        throw new Error("Invalid base64: padding can only appear at the end");
      }

      // If third char is padding, fourth must also be padding.
      if (isPad2 && !isPad3) {
        throw new Error("Invalid base64: invalid padding");
      }
    }
  }

  return out;
}

export interface ParsedDataUrl {
  mime: string;
  bytes: Uint8Array;
}

/**
 * Create a base64 data URL.
 */
export function toDataUrl(mime: string, bytes: Uint8Array): string {
  if (!mime) throw new Error("mime is required");
  return `data:${mime};base64,${encodeBase64(bytes)}`;
}

/**
 * Parse a base64 data URL.
 *
 * Supports `data:<mime>;base64,<payload>`.
 */
export function parseDataUrl(url: string): ParsedDataUrl {
  if (!url.startsWith("data:")) {
    throw new Error("Invalid data URL: must start with 'data:'");
  }

  const commaIndex = url.indexOf(",");
  if (commaIndex === -1) {
    throw new Error("Invalid data URL: missing ',' separator");
  }

  const meta = url.slice(5, commaIndex);
  const payload = url.slice(commaIndex + 1);

  // We only support base64 payloads.
  const metaParts = meta.split(";");
  const mime = metaParts[0] || "application/octet-stream";
  const isBase64 = metaParts.some((p) => p.toLowerCase() === "base64");
  if (!isBase64) {
    throw new Error("Invalid data URL: only base64 payloads are supported");
  }

  return { mime, bytes: decodeBase64(payload) };
}
