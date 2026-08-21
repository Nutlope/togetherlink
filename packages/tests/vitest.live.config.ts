import { configDefaults, defineConfig } from "vitest/config";

const retry = Number(process.env.VITEST_RETRY ?? "0");
const requestedFile = process.env.TOGETHERLINK_LIVE_TEST_FILE;
const include = requestedFile
  ? [requestedFile]
  : [
      "src/Claude.test.ts",
      "src/Codex.test.ts",
      "src/Grok.test.ts",
      "src/OpenCode.test.ts",
      "src/Pi.test.ts",
      "src/LivePrimeRlm.test.ts",
    ];

export default defineConfig({
  test: {
    include,
    exclude: [...configDefaults.exclude, "tmp/**"],
    globals: true,
    fileParallelism: false,
    maxConcurrency: 1,
    retry,
    testTimeout: 360_000,
    hookTimeout: 120_000,
    reporters: "verbose",
  },
});
