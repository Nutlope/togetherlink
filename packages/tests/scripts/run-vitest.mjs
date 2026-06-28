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

const test = spawnSync(pnpm, ["exec", "vitest", "run", "--config", "vitest.config.ts", ...vitestArgs], {
  stdio: "inherit",
});

process.exit(test.status ?? 1);
