/**
 * XMP (Extensible Metadata Platform) parsing and writing utilities
 *
 * This module provides utilities for reading and writing XMP metadata in image files.
 * It supports Dublin Core, EXIF, and Photoshop namespaces.
 */

import type { ImageMetadata } from "../../types.ts";

/**
 * XMP namespace URIs
 */
export const XMP_NAMESPACES = {
  RDF: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  DC: "http://purl.org/dc/elements/1.1/",
  XMP: "http://ns.adobe.com/xap/1.0/",
  EXIF: "http://ns.adobe.com/exif/1.0/",
  TIFF: "http://ns.adobe.com/tiff/1.0/",
  PHOTOSHOP: "http://ns.adobe.com/photoshop/1.0/",
  XMP_RIGHTS: "http://ns.adobe.com/xap/1.0/rights/",
} as const;

/**
 * XMP Dublin Core field mapping to ImageMetadata
 */
export interface XMPFieldMapping {
  xmpPath: string;
  metadataKey: keyof ImageMetadata;
  namespace: string;
}

/**
 * Supported XMP fields and their mappings
 */
export const XMP_FIELD_MAPPINGS: XMPFieldMapping[] = [
  // Dublin Core
  { xmpPath: "dc:title", metadataKey: "title", namespace: XMP_NAMESPACES.DC },
  {
    xmpPath: "dc:description",
    metadataKey: "description",
    namespace: XMP_NAMESPACES.DC,
  },
  {
    xmpPath: "dc:creator",
    metadataKey: "author",
    namespace: XMP_NAMESPACES.DC,
  },
  {
    xmpPath: "dc:rights",
    metadataKey: "copyright",
    namespace: XMP_NAMESPACES.DC,
  },
  // EXIF namespace
  {
    xmpPath: "exif:DateTimeOriginal",
    metadataKey: "creationDate",
    namespace: XMP_NAMESPACES.EXIF,
  },
  {
    xmpPath: "exif:ISOSpeedRatings",
    metadataKey: "iso",
    namespace: XMP_NAMESPACES.EXIF,
  },
  {
    xmpPath: "exif:ExposureTime",
    metadataKey: "exposureTime",
    namespace: XMP_NAMESPACES.EXIF,
  },
  {
    xmpPath: "exif:FNumber",
    metadataKey: "fNumber",
    namespace: XMP_NAMESPACES.EXIF,
  },
  {
    xmpPath: "exif:FocalLength",
    metadataKey: "focalLength",
    namespace: XMP_NAMESPACES.EXIF,
  },
  {
    xmpPath: "exif:Flash",
    metadataKey: "flash",
    namespace: XMP_NAMESPACES.EXIF,
  },
  {
    xmpPath: "exif:WhiteBalance",
    metadataKey: "whiteBalance",
    namespace: XMP_NAMESPACES.EXIF,
  },
  {
    xmpPath: "exif:UserComment",
    metadataKey: "userComment",
    namespace: XMP_NAMESPACES.EXIF,
  },
  // TIFF namespace
  {
    xmpPath: "tiff:Make",
    metadataKey: "cameraMake",
    namespace: XMP_NAMESPACES.TIFF,
  },
  {
    xmpPath: "tiff:Model",
    metadataKey: "cameraModel",
    namespace: XMP_NAMESPACES.TIFF,
  },
  {
    xmpPath: "tiff:Orientation",
    metadataKey: "orientation",
    namespace: XMP_NAMESPACES.TIFF,
  },
  {
    xmpPath: "tiff:Software",
    metadataKey: "software",
    namespace: XMP_NAMESPACES.TIFF,
  },
  // Photoshop namespace
  {
    xmpPath: "photoshop:Credit",
    metadataKey: "author",
    namespace: XMP_NAMESPACES.PHOTOSHOP,
  },
];

/**
 * Escape XML special characters
 */
export function escapeXML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Unescape XML special characters
 */
export function unescapeXML(str: string): string {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Parse XMP metadata from XML string
 */
export function parseXMP(xmpStr: string): Partial<ImageMetadata> {
  const metadata: Partial<ImageMetadata> = {};

  try {
    // Simple regex-based parsing for common fields
    // Dublin Core - title (with dotall flag 's')
    const titleMatch = xmpStr.match(
      /<dc:title[\s\S]*?<rdf:li[^>]*>([^<]+)<\/rdf:li>/,
    );
    if (titleMatch && titleMatch[1].trim()) {
      metadata.title = unescapeXML(titleMatch[1].trim());
    }

    // Dublin Core - description
    const descMatch = xmpStr.match(
      /<dc:description[\s\S]*?<rdf:li[^>]*>([^<]+)<\/rdf:li>/,
    );
    if (descMatch && descMatch[1].trim()) {
      metadata.description = unescapeXML(descMatch[1].trim());
    }

    // Dublin Core - creator
    const creatorMatch = xmpStr.match(
      /<dc:creator[\s\S]*?<rdf:li[^>]*>([^<]+)<\/rdf:li>/,
    );
    if (creatorMatch && creatorMatch[1].trim()) {
      metadata.author = unescapeXML(creatorMatch[1].trim());
    }

    // Dublin Core - rights
    const rightsMatch = xmpStr.match(
      /<dc:rights[\s\S]*?<rdf:li[^>]*>([^<]+)<\/rdf:li>/,
    );
    if (rightsMatch && rightsMatch[1].trim()) {
      metadata.copyright = unescapeXML(rightsMatch[1].trim());
    }

    // EXIF - DateTimeOriginal
    const dateMatch = xmpStr.match(
      /<exif:DateTimeOriginal>([^<]+)<\/exif:DateTimeOriginal>/,
    );
    if (dateMatch) {
      try {
        metadata.creationDate = new Date(dateMatch[1]);
      } catch (_e) {
        // Ignore date parse errors
      }
    }

    // TIFF - Make and Model
    const makeMatch = xmpStr.match(/<tiff:Make>([^<]+)<\/tiff:Make>/);
    if (makeMatch) {
      metadata.cameraMake = unescapeXML(makeMatch[1]);
    }

    const modelMatch = xmpStr.match(/<tiff:Model>([^<]+)<\/tiff:Model>/);
    if (modelMatch) {
      metadata.cameraModel = unescapeXML(modelMatch[1]);
    }

    const softwareMatch = xmpStr.match(
      /<tiff:Software>([^<]+)<\/tiff:Software>/,
    );
    if (softwareMatch) {
      metadata.software = unescapeXML(softwareMatch[1]);
    }

    const orientationMatch = xmpStr.match(
      /<tiff:Orientation>([^<]+)<\/tiff:Orientation>/,
    );
    if (orientationMatch) {
      metadata.orientation = parseInt(orientationMatch[1]);
    }

    // EXIF - Camera settings
    const isoMatch = xmpStr.match(
      /<exif:ISOSpeedRatings>(?:<rdf:Seq[^>]*><rdf:li>)?([^<]+)/,
    );
    if (isoMatch) {
      metadata.iso = parseInt(isoMatch[1]);
    }

    const exposureMatch = xmpStr.match(
      /<exif:ExposureTime>([^<]+)<\/exif:ExposureTime>/,
    );
    if (exposureMatch) {
      // Handle rational format (e.g., "1/250")
      if (exposureMatch[1].includes("/")) {
        const [num, den] = exposureMatch[1].split("/").map(Number);
        metadata.exposureTime = num / den;
      } else {
        metadata.exposureTime = parseFloat(exposureMatch[1]);
      }
    }

    const fNumberMatch = xmpStr.match(/<exif:FNumber>([^<]+)<\/exif:FNumber>/);
    if (fNumberMatch) {
      metadata.fNumber = parseFloat(fNumberMatch[1]);
    }

    const focalLengthMatch = xmpStr.match(
      /<exif:FocalLength>([^<]+)<\/exif:FocalLength>/,
    );
    if (focalLengthMatch) {
      metadata.focalLength = parseFloat(focalLengthMatch[1]);
    }
  } catch (_e) {
    // Ignore XMP parsing errors
  }

  return metadata;
}

/**
 * Create XMP packet from metadata
 */
export function createXMP(metadata: Partial<ImageMetadata>): string {
  const parts: string[] = [];

  parts.push('<?xpacket begin="\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?>');
  parts.push('<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="@cross/image">');
  parts.push('<rdf:RDF xmlns:rdf="' + XMP_NAMESPACES.RDF + '">');
  parts.push('<rdf:Description rdf:about=""');
  parts.push('  xmlns:dc="' + XMP_NAMESPACES.DC + '"');
  parts.push('  xmlns:xmp="' + XMP_NAMESPACES.XMP + '"');
  parts.push('  xmlns:exif="' + XMP_NAMESPACES.EXIF + '"');
  parts.push('  xmlns:tiff="' + XMP_NAMESPACES.TIFF + '"');
  parts.push('  xmlns:photoshop="' + XMP_NAMESPACES.PHOTOSHOP + '"');
  parts.push('  xmlns:xmpRights="' + XMP_NAMESPACES.XMP_RIGHTS + '">');

  // Dublin Core - title
  if (metadata.title) {
    parts.push("  <dc:title>");
    parts.push("    <rdf:Alt>");
    parts.push(
      '      <rdf:li xml:lang="x-default">' + escapeXML(metadata.title) +
        "</rdf:li>",
    );
    parts.push("    </rdf:Alt>");
    parts.push("  </dc:title>");
  }

  // Dublin Core - description
  if (metadata.description) {
    parts.push("  <dc:description>");
    parts.push("    <rdf:Alt>");
    parts.push(
      '      <rdf:li xml:lang="x-default">' + escapeXML(metadata.description) +
        "</rdf:li>",
    );
    parts.push("    </rdf:Alt>");
    parts.push("  </dc:description>");
  }

  // Dublin Core - creator
  if (metadata.author) {
    parts.push("  <dc:creator>");
    parts.push("    <rdf:Seq>");
    parts.push("      <rdf:li>" + escapeXML(metadata.author) + "</rdf:li>");
    parts.push("    </rdf:Seq>");
    parts.push("  </dc:creator>");
  }

  // Dublin Core - rights
  if (metadata.copyright) {
    parts.push("  <dc:rights>");
    parts.push("    <rdf:Alt>");
    parts.push(
      '      <rdf:li xml:lang="x-default">' + escapeXML(metadata.copyright) +
        "</rdf:li>",
    );
    parts.push("    </rdf:Alt>");
    parts.push("  </dc:rights>");
  }

  // EXIF - DateTimeOriginal
  if (metadata.creationDate) {
    const isoDate = metadata.creationDate.toISOString();
    parts.push(
      "  <exif:DateTimeOriginal>" + isoDate + "</exif:DateTimeOriginal>",
    );
  }

  // TIFF - Make and Model
  if (metadata.cameraMake) {
    parts.push(
      "  <tiff:Make>" + escapeXML(metadata.cameraMake) + "</tiff:Make>",
    );
  }
  if (metadata.cameraModel) {
    parts.push(
      "  <tiff:Model>" + escapeXML(metadata.cameraModel) + "</tiff:Model>",
    );
  }
  if (metadata.software) {
    parts.push(
      "  <tiff:Software>" + escapeXML(metadata.software) + "</tiff:Software>",
    );
  }
  if (metadata.orientation !== undefined) {
    parts.push(
      "  <tiff:Orientation>" + metadata.orientation + "</tiff:Orientation>",
    );
  }

  // EXIF - Camera settings
  if (metadata.iso !== undefined) {
    parts.push("  <exif:ISOSpeedRatings>");
    parts.push("    <rdf:Seq>");
    parts.push("      <rdf:li>" + metadata.iso + "</rdf:li>");
    parts.push("    </rdf:Seq>");
    parts.push("  </exif:ISOSpeedRatings>");
  }
  if (metadata.exposureTime !== undefined) {
    parts.push(
      "  <exif:ExposureTime>" + metadata.exposureTime + "</exif:ExposureTime>",
    );
  }
  if (metadata.fNumber !== undefined) {
    parts.push("  <exif:FNumber>" + metadata.fNumber + "</exif:FNumber>");
  }
  if (metadata.focalLength !== undefined) {
    parts.push(
      "  <exif:FocalLength>" + metadata.focalLength + "</exif:FocalLength>",
    );
  }

  parts.push("</rdf:Description>");
  parts.push("</rdf:RDF>");
  parts.push("</x:xmpmeta>");
  parts.push('<?xpacket end="w"?>');

  return parts.join("\n");
}

/**
 * Get list of supported XMP metadata fields
 */
export function getSupportedXMPFields(): Array<keyof ImageMetadata> {
  return [
    "title",
    "description",
    "author",
    "copyright",
    "creationDate",
    "cameraMake",
    "cameraModel",
    "orientation",
    "software",
    "iso",
    "exposureTime",
    "fNumber",
    "focalLength",
  ];
}
