#!/usr/bin/env node
import { loadEnvFile } from "../lib/load-env.js";
import { parseArgs } from "../lib/parse-args.js";
import { printHelp, runConfigure } from "../lib/commands/global.js";
import { dispatchHarnessCommand } from "../lib/commands/harness.js";
import { readGlobalConfig, resolveStoredExaApiKey } from "../lib/global-config.js";

// Load a .env (cwd → repo root) before anything reads process.env, so keys
// like TOGETHER_API_KEY / EXA_API_KEY are available without manual sourcing.
loadEnvFile();

// If EXA_API_KEY still isn't set (not in the env or .env), fall back to the
// key stored by `togetherlink configure`, so the proxy's web search works
// without the user re-sourcing .env every session. Done without awaiting on
// startup is unsafe (the proxy may read env before this resolves), so we load
// it synchronously via the stored config path for the common case.
await loadStoredExaKey();

async function loadStoredExaKey(): Promise<void> {
  if (process.env.EXA_API_KEY) {
    return;
  }
  try {
    const { exaApiKey } = await readGlobalConfig(process.env.HOME);
    const resolved = resolveStoredExaApiKey(exaApiKey);
    if (resolved) {
      process.env.EXA_API_KEY = resolved;
    }
  } catch {
    // No config yet (e.g. before first `configure`) — nothing to do.
  }
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const [command, verb] = positional;

  if (!command || command === "help" || command === "--help") {
    printHelp();
    return;
  }

  if (command === "configure") {
    await runConfigure();
    return;
  }

  await dispatchHarnessCommand(command, verb, flags);
}

main().catch((err: unknown) => {
  if (!(err instanceof Error)) {
    console.error(`Error: ${String(err)}`);
    process.exitCode = 1;
    return;
  }
  console.error(`Error: ${err.message}`);
  process.exitCode = 1;
});
