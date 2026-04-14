import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const workspaceRoot = path.resolve(__dirname, "../..");

export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      // Resolve workspace package to source so Vite watches and updates it in desktop dev.
      "@emk/media-viewer": path.resolve(workspaceRoot, "packages/media-viewer/src/index.ts"),
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    fs: {
      allow: [workspaceRoot],
    },
  },
  optimizeDeps: {
    // Prevent prebundling workspace source package as immutable dependency.
    exclude: ["@emk/media-viewer"],
  },
  build: {
    outDir: "dist-renderer",
    emptyOutDir: true,
  },
});
