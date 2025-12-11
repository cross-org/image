// scripts/build_npm.ts
import { build, emptyDir } from "@deno/dnt";

import pkg from "../deno.json" with { type: "json" };

const outputDir = "./npm";

await emptyDir(outputDir);

await build({
  importMap: "deno.json",
  entryPoints: ["./mod.ts"],
  outDir: outputDir,
  shims: {
    deno: false,
  },
  package: {
    name: "cross-image",
    version: pkg.version,
    description:
      "A pure JavaScript, dependency-free, cross-runtime image processing library for Deno, Node.js, and Bun.",
    license: "MIT",
    repository: {
      type: "git",
      url: "git+https://github.com/cross-org/image.git",
    },
    bugs: {
      url: "https://github.com/cross-org/image/issues",
    },
    homepage: "https://github.com/cross-org/image",
    keywords: [
      "image",
      "image-processing",
      "image-manipulation",
      "image-resize",
      "image-decode",
      "image-encode",
      "png",
      "apng",
      "jpeg",
      "webp",
      "gif",
      "tiff",
      "bmp",
      "ico",
      "dng",
      "heic",
      "avif",
      "pam",
      "ppm",
      "pcx",
      "ascii-art",
      "metadata",
      "exif",
      "cross-runtime",
      "pure-javascript",
      "no-dependencies",
      "deno",
      "node",
      "bun",
    ],
    engines: {
      node: ">=18.0.0",
    },
  },
  async postBuild() {
    Deno.copyFileSync("LICENSE", "npm/LICENSE");
    Deno.copyFileSync("README.md", "npm/README.md");
    const npmIgnore = "npm/.npmignore";
    const npmIgnoreContent = [
      "*.map",
      "examples/",
      "test/",
      "test_output/",
      "docs/",
      ".github/",
    ].join("\n");
    try {
      const content = await Deno.readTextFile(npmIgnore);
      await Deno.writeTextFile(npmIgnore, content + "\n" + npmIgnoreContent);
    } catch {
      await Deno.writeTextFile(npmIgnore, npmIgnoreContent);
    }
  },
  typeCheck: "both",
  test: false,
  compilerOptions: {
    lib: ["ESNext", "DOM", "DOM.Iterable"],
    sourceMap: false,
    inlineSources: false,
  },
});
