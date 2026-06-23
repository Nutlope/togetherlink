#!/usr/bin/env node
import { loadEnvFile } from "../lib/load-env.js";
import { parseArgs } from "../lib/parse-args.js";
import { printHelp, runConfigure } from "../lib/commands/global.js";
import { dispatchHarnessCommand } from "../lib/commands/harness.js";
import { readGlobalConfig, resolveStoredExaApiKey, resolveStoredApiKey } from "../lib/global-config.js";
import { maybeSelfUpdate } from "../lib/autoupdate.js";
import { VERSION } from "../lib/version.js";

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

/**
 * On the first `togetherlink claude`/`opencode` run after install, if no API
 * key is configured anywhere, prompt for it once. Enter = skip (optional): a
 * skipped key just means the harness throws a clear "set a key" message later,
 * and the user can run `togetherlink configure` or set the env var. This makes
 * the post-install flow require zero extra steps for the eager user.
 */
async function maybePromptApiKey(): Promise<void> {
  try {
    const home = process.env.HOME;
    if (!home) {
      return;
    }
    const existing = resolveStoredApiKey((await readGlobalConfig(home)).apiKey);
    if (existing || process.env.TOGETHER_API_KEY) {
      return;
    }
    const clack = await import("@clack/prompts");
    clack.intro("togetherlink — first-run setup");
    const entered = await clack.password({
      message: "Together API key (from https://api.together.ai/settings/api-keys)\n  press Enter to skip — you can add it later with `togetherlink configure`:",
      validate: () => undefined, // empty is allowed
    });
    if (clack.isCancel(entered)) {
      clack.cancel("Cancelled.");
      return;
    }
    const key = entered.trim();
    if (!key) {
      clack.log.info("Skipped — set a key later with `togetherlink configure` or TOGETHER_API_KEY.");
      clack.outro("Ready. Re-run your command to start.");
      return;
    }
    const { setGlobalApiKey } = await import("../lib/global-config.js");
    await setGlobalApiKey(home, key);
    clack.log.success("API key saved to ~/.togetherlink/config.json");
    clack.outro("Ready. Re-run your command to start.");
  } catch {
    // Setup prompt is best-effort; never block the command on it.
  }
}

async function main() {
  // Self-update first (throttled, bounded, never throws). Placed before arg
  // parsing so even `togetherlink help` keeps an install current, but it's a
  // no-op unless this is the installed bundle and the throttle window passed.
  await maybeSelfUpdate();

  const { positional, flags } = parseArgs(process.argv.slice(2));
  const [command, verb] = positional;

  if (!command || command === "help" || command === "--help") {
    printHelp();
    return;
  }

  if (command === "--version" || command === "-v" || command === "version") {
    process.stdout.write(`togetherlink v${VERSION}\n`);
    return;
  }

  if (command === "configure") {
    await runConfigure();
    return;
  }

  // First-run key setup only matters for the harness-launching commands.
  if ((command === "claude" || command === "opencode") && verb !== "status") {
    await maybePromptApiKey();
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