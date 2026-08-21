import { configDefaults, defineConfig } from "vitest/config";

const retry = Number(process.env.VITEST_RETRY ?? "0");
const liveTests = [
  "src/Claude.test.ts",
  "src/Codex.test.ts",
  "src/Grok.test.ts",
  "src/OpenCode.test.ts",
  "src/Pi.test.ts",
  "src/LiveCodexResume.test.ts",
  "src/LivePrimeRlm.test.ts",
  "src/LiveSmoke.test.ts",
  "src/livemodelscheck.test.ts",
];

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "tmp/**", ...liveTests],
    globals: true,
    fileParallelism: process.env.VITEST_FILE_PARALLELISM !== "0",
    maxConcurrency: Number(process.env.VITEST_MAX_CONCURRENCY ?? "5"),
    retry,
    testTimeout: 360_000,
    hookTimeout: 120_000,
    reporters: "default",
  },
});
