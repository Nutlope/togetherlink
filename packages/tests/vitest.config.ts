import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "tmp/**"],
    globals: true,
    fileParallelism: true,
    maxConcurrency: Number(process.env.VITEST_MAX_CONCURRENCY ?? "5"),
    testTimeout: 360_000,
    hookTimeout: 120_000,
    reporters: "default",
  },
});
