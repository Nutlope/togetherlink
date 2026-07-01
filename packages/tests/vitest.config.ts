import { configDefaults, defineConfig } from "vitest/config";

const retry = Number(process.env.VITEST_RETRY ?? "0");

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "tmp/**"],
    globals: true,
    fileParallelism: process.env.VITEST_FILE_PARALLELISM !== "0",
    maxConcurrency: Number(process.env.VITEST_MAX_CONCURRENCY ?? "5"),
    retry,
    testTimeout: 360_000,
    hookTimeout: 120_000,
    reporters: "default",
  },
});
