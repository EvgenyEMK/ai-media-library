import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "electron/**/*.test.ts",
      "electron/**/*.test.tsx",
      "tests/e2e/fixtures/**/*.test.ts",
    ],
    coverage: {
      provider: "v8",
      include: ["src/renderer/lib/**/*.ts", "electron/**/*.ts"],
      exclude: ["**/index.ts"],
    },
  },
});
