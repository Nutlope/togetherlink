import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    fileParallelism: false,
    testTimeout: 360_000,
    hookTimeout: 120_000,
    reporters: "default",
  },
});
