#!/usr/bin/env node
import os from "node:os";
import { loadEnvFile } from "../lib/load-env.js";
import { parseArgs } from "../lib/parse-args.js";
import { printHelp, runConfigure } from "../lib/commands/global.js";
import { dispatchHarnessCommand } from "../lib/commands/harness.js";
import { isHarnessCommand, resolveHarnessInvocation } from "../lib/commands/harness-invocation.js";
import { readGlobalConfig, resolveStoredExaApiKey, resolveStoredApiKey } from "../lib/global-config.js";
import { maybeSelfUpdate } from "../lib/autoupdate.js";
import { sendTelemetryEvent } from "../lib/telemetry.js";
import { VERSION } from "../lib/version.js";

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

async function hasTogetherApiKey(): Promise<boolean> {
  try {
    const home = process.env.HOME;
    if (!home) {
      return Boolean(process.env.TOGETHER_API_KEY?.trim());
    }
    const existing = resolveStoredApiKey((await readGlobalConfig(home)).apiKey);
    return Boolean(existing || process.env.TOGETHER_API_KEY?.trim());
  } catch {
    return Boolean(process.env.TOGETHER_API_KEY?.trim());
  }
}

async function ensureConfiguredForInteractiveLaunch(): Promise<boolean> {
  if (await hasTogetherApiKey()) {
    return true;
  }
  if (!isInteractive()) {
    return false;
  }

  const configured = await runConfigure();
  await loadStoredExaKey();
  return configured && (await hasTogetherApiKey());
}

async function runInteractiveLauncher(): Promise<void> {
  if (!isInteractive()) {
    printHelp();
    return;
  }

  if (!(await ensureConfiguredForInteractiveLaunch())) {
    return;
  }

  const clack = await import("@clack/prompts");
  const choice = await clack.select({
    message: "What do you want to run?",
    options: [
      { value: "codex", label: "Codex", hint: "tcodex" },
      { value: "claude", label: "Claude Code", hint: "tclaude" },
      { value: "pi", label: "Pi Code", hint: "tpi" },
      { value: "opencode", label: "OpenCode", hint: "topencode" },
      { value: "configure", label: "Configure", hint: "API keys and detected tools" },
    ],
  });
  if (clack.isCancel(choice)) {
    clack.cancel("Cancelled.");
    return;
  }
  if (choice === "configure") {
    await runConfigure();
    return;
  }

  await dispatchHarnessCommand(choice, undefined, {});
}

function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

async function main() {
  // Self-update first (throttled, bounded, never throws). Placed before arg
  // parsing so even `togetherlink help` keeps an install current, but it's a
  // no-op unless this is the installed bundle and the throttle window passed.
  // Keep this before loading project .env files so a repo cannot redirect the
  // updater with TOGETHERLINK_MANIFEST_URL / TOGETHERLINK_HOME.
  await maybeSelfUpdate();

  // Load a .env (cwd → repo root) after self-update, and only for approved
  // credential keys, so local project env files cannot control the CLI runtime.
  loadEnvFile();

  // If EXA_API_KEY still isn't set (not in the env or .env), fall back to the
  // key stored by `togetherlink configure`, so the proxy's web search works
  // without the user re-sourcing .env every session.
  await loadStoredExaKey();

  const parsed = parseArgs(process.argv.slice(2));
  const [rawCommand, rawVerb] = parsed.positional;
  const command = rawCommand === "picode" ? "pi" : rawCommand;

  if (!command) {
    await runInteractiveLauncher();
    return;
  }

  if (command === "help" || command === "--help" || command === "-h") {
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

  // Internal entry point run by install.sh right after a successful install
  // verification. Not user-facing; emits the one-time install event.
  if (command === "__telemetry-install-completed") {
    await sendTelemetryEvent({ event: "install_completed" });
    return;
  }

  // Internal entry point: the daemon self-spawns with `--daemon` via
  // ensureDaemon() (launch.ts). Runs the shared proxy server forever; never
  // returns. Keep this before any command that needs a key — the daemon needs
  // no daemon-wide credentials (each session registers its own).
  if (command === "--daemon") {
    const { runDaemon } = await import("../lib/daemon/server.js");
    await runDaemon();
    return;
  }

  // User-facing daemon control. Not a harness, so handle it before the harness
  // dispatch (which would reject "daemon" as an unknown harness).
  if (command === "daemon") {
    if (rawVerb === undefined) {
      throw new Error('Unknown "daemon" command. Expected: profile, stop.');
    }
    const { runDaemonCommand } = await import("../lib/daemon/cli.js");
    await runDaemonCommand(rawVerb);
    return;
  }

  if (command === "codex-app") {
    if (!parsed.flags.restore && !(await ensureConfiguredForInteractiveLaunch())) {
      throw new Error("No Together API key found. Run `togetherlink configure` or set TOGETHER_API_KEY.");
    }
    const { runCodexAppCommand } = await import("../lib/codex-app.js");
    const result = await runCodexAppCommand({ home: os.homedir(), ...parsed.flags });
    if (result.message) {
      console.log(result.message);
    }
    if (result.payload) {
      console.log(JSON.stringify(result.payload, null, 2));
    }
    return;
  }

  const invocation = resolveHarnessInvocation(parsed.positional, parsed.flags);

  // First-run key setup only matters for the harness-launching commands.
  if (
    (invocation.command === "claude" ||
      invocation.command === "codex" ||
      invocation.command === "opencode" ||
      invocation.command === "pi") &&
    invocation.command !== undefined
  ) {
    if (!(await ensureConfiguredForInteractiveLaunch())) {
      throw new Error("No Together API key found. Run `togetherlink configure` or set TOGETHER_API_KEY.");
    }
  }

  if (isHarnessCommand(invocation.command)) {
    void sendTelemetryEvent({ event: "cli_started", agent: invocation.command });
  }

  await dispatchHarnessCommand(invocation.command, undefined, invocation.flags);
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
