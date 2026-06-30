import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["benchmarks/**/*.bench.ts"],
    globals: true,
    fileParallelism: false,
    maxConcurrency: 1,
    testTimeout: 60_000,
    hookTimeout: 30_000,
    reporters: "default",
  },
});
