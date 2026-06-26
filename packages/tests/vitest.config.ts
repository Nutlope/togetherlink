import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "tmp/**"],
    globals: true,
    fileParallelism: true,
    testTimeout: 360_000,
    hookTimeout: 120_000,
    reporters: "default",
  },
});
