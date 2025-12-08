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
      "png",
      "jpeg",
      "webp",
      "gif",
      "tiff",
      "bmp",
      "dng",
      "pam",
      "pcx",
      "cross-runtime",
      "deno",
      "node",
      "bun",
    ],
  },
  async postBuild() {
    Deno.copyFileSync("LICENSE", "npm/LICENSE");
    Deno.copyFileSync("README.md", "npm/README.md");
    const npmIgnore = "npm/.npmignore";
    try {
      const content = await Deno.readTextFile(npmIgnore);
      await Deno.writeTextFile(npmIgnore, content + "\n*.map");
    } catch {
      await Deno.writeTextFile(npmIgnore, "*.map");
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
