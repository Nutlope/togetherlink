#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const forwardedArgs = process.argv.slice(2);
const vitestArgs = forwardedArgs[0] === "--" ? forwardedArgs.slice(1) : forwardedArgs;

const build = spawnSync(pnpm, ["-F", "@togetherlink/cli", "build"], {
  stdio: "inherit",
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const test = spawnSync(
  pnpm,
  ["exec", "vitest", "run", "--config", "vitest.config.ts", ...vitestArgs],
  {
    // The default suite contains real Claude, Codex, Grok, OpenCode, and Pi
    // inference gauntlets. Running their files concurrently saturates a shared
    // Together account and turns healthy harnesses into response-header
    // timeouts. Match the release workflow's serial default while preserving
    // an explicit developer override.
    env: {
      ...process.env,
      VITEST_FILE_PARALLELISM: process.env.VITEST_FILE_PARALLELISM ?? "0",
    },
    stdio: "inherit",
  },
);

process.exit(test.status ?? 1);
