import { builtinModules } from "node:module";
import path from "node:path";
import { defineConfig } from "vite";

const external = [
  "electron",
  // Native module must stay external for Electron runtime loading.
  "better-sqlite3",
  "bindings",
  "node-gyp-build",
  // Resolves vendored ExifTool binary via dynamic require; bundling breaks path lookup.
  "exiftool-vendored",
  // Mutates `module.exports` at runtime; Rollup's ESM interop yields read-only namespace (setter throws).
  "local-reverse-geocoder",
  // Transformers.js + ONNX runtime: must be loaded at runtime, not bundled.
  "@huggingface/transformers",
  "onnxruntime-node",
  "sharp",
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`),
];

export default defineConfig({
  resolve: {
    // Force Node.js package entry points so libraries like Jimp use their
    // Node build (file I/O, native buffers) instead of the browser build.
    conditions: ["node"],
  },
  // Electron main process runs in Node.js — keep process.env as a runtime
  // reference instead of replacing it with a build-time constant.
  define: {
    "process.env": "process.env",
  },
  build: {
    outDir: "dist-electron",
    emptyOutDir: true,
    sourcemap: true,
    target: "node20",
    rollupOptions: {
      external,
      input: {
        main: path.resolve(__dirname, "electron/main.ts"),
        preload: path.resolve(__dirname, "electron/preload.ts"),
      },
      output: {
        format: "cjs",
        entryFileNames: "[name].js",
      },
    },
  },
});
