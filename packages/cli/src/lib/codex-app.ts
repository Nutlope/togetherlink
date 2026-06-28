import { execFile, spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { CODEX_DEFAULT_MODEL, CODEX_PROVIDER_ID, CODEX_SUPPORTED_MODELS, resolveCodexModel } from "./codex/defaults.js";
import { daemonFetch, daemonSessionUrl, ensureDaemon, localProxyAuthToken, registerDaemonSession } from "./daemon/launch.js";
import type { HarnessContext, HarnessResult } from "./harness-types.js";
import { resolveTogetherApiKey } from "./together-core.js";
import type { ModelDefinition } from "@togetherlink/models";

const CODEX_APP_PROVIDER_ID = `${CODEX_PROVIDER_ID}_codex_app`;
const CODEX_APP_CONFIG_MARKER_START = "# >>> togetherlink codex-app alpha >>>";
const CODEX_APP_CONFIG_MARKER_END = "# <<< togetherlink codex-app alpha <<<";
const BACKUP_MANIFEST = "latest.json";
const execFileAsync = promisify(execFile);

type BackupEntry = {
  path: string;
  backupPath?: string;
  existed: boolean;
};

type BackupManifest = {
  createdAt: string;
  files: BackupEntry[];
};

type CodexAppSessionLock = {
  pid: number;
  startedAt: string;
  sessionToken: string;
  configPath: string;
  catalogPath: string;
};

export async function runCodexAppCommand(ctx: HarnessContext): Promise<HarnessResult> {
  if (ctx.restore) {
    return restoreCodexApp(ctx.home);
  }

  const apiKey = await resolveTogetherApiKey({
    apiKey: ctx.apiKey,
    home: ctx.home,
  });
  if (!apiKey) {
    throw new Error("No Together API key found. Pass --api-key, run `togetherlink configure`, or set TOGETHER_API_KEY.");
  }

  const selectedModel = resolveCodexModel(ctx.main);
  const authToken = await localProxyAuthToken();
  const sessionToken = codexAppSessionToken(authToken);
  const { url: proxyUrl } = await ensureDaemon();
  const agentProxyUrl = daemonSessionUrl(proxyUrl, sessionToken);
  const catalogPath = await writePersistentModelCatalog(ctx.home);

  await registerDaemonSession(proxyUrl, {
    token: sessionToken,
    authToken,
    agent: "codex",
    apiKey,
    modelLabel: `${selectedModel.definition.name} (Codex App alpha)`,
    modelId: selectedModel.definition.id,
    targetModelId: selectedModel.definition.id,
    modelName: selectedModel.definition.name,
    modelDefinition: selectedModel.definition,
    ...(process.env.TOGETHERLINK_DEBUG === "1" ? { debug: true } : {}),
  });

  const configPath = codexConfigPath(ctx.home);
  const backup = await backupCodexAppConfig(ctx.home, configPath);
  const existing = await readTextIfExists(configPath);
  const next = buildCodexAppConfig(existing ?? "", {
    modelId: selectedModel.definition.id,
    providerId: CODEX_APP_PROVIDER_ID,
    providerName: "Togetherlink",
    baseUrl: `${agentProxyUrl}/v1`,
    bearerToken: authToken,
    catalogPath,
    contextWindow: selectedModel.definition.limit.context,
  });
  await writeTextAtomic(configPath, next);
  await writeAppSessionLock(ctx.home, {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    sessionToken,
    configPath,
    catalogPath,
  });

  const launch = await launchCodexApp({ reason: "configured", openIfClosed: true });
  const intro = [
    "Codex App profile changed to Togetherlink. (alpha)",
    `Model: ${selectedModel.definition.name}`,
    "Start a task or open a repository in Codex App as usual.",
    "Restore your previous Codex App profile with: togetherlink codex-app --restore",
    `Backup: ${backup}`,
    codexAppLaunchMessage(launch),
  ].filter(Boolean).join("\n");

  return { message: intro };
}

export function buildCodexAppConfig(
  rawConfig: string,
  options: {
    modelId: string;
    providerId: string;
    providerName: string;
    baseUrl: string;
    bearerToken: string;
    catalogPath: string;
    contextWindow?: number;
  },
): string {
  const withoutManagedBlock = removeManagedBlock(rawConfig);
  const withoutLegacyTables = removeTomlSections(withoutManagedBlock, [
    `profiles.${options.providerId}`,
    `profiles."${options.providerId}"`,
    `model_providers.${options.providerId}`,
    `model_providers."${options.providerId}"`,
  ]);
  const [preamble, rest] = splitTomlPreamble(withoutLegacyTables);
  const managedPreamble = upsertTopLevelTomlKeys(preamble, {
    model: tomlString(options.modelId),
    model_provider: tomlString(options.providerId),
    model_catalog_json: tomlString(options.catalogPath),
    ...(options.contextWindow ? {
      model_context_window: String(options.contextWindow),
      model_auto_compact_token_limit: String(Math.floor(options.contextWindow * 0.7)),
    } : {}),
  });
  const cleanedPreamble = removeTopLevelTomlKeys(managedPreamble, ["model_reasoning_effort", "openai_base_url", "profile"]);
  const providerBlock = [
    CODEX_APP_CONFIG_MARKER_START,
    "# togetherlink codex-app configures a dedicated alpha provider for Codex Desktop.",
    `[model_providers.${options.providerId}]`,
    `name = ${tomlString(options.providerName)}`,
    `base_url = ${tomlString(options.baseUrl)}`,
    'wire_api = "responses"',
    CODEX_APP_CONFIG_MARKER_END,
    "",
  ].join("\n");
  const body = `${cleanedPreamble}${rest}`;
  const trimmedBody = body.endsWith("\n") ? body : `${body}\n`;
  return `${trimmedBody}\n${providerBlock}`;
}

async function restoreCodexApp(home: string): Promise<HarnessResult> {
  const manifestPath = path.join(backupDir(home), BACKUP_MANIFEST);
  const raw = await readTextIfExists(manifestPath);
  if (!raw) {
    throw new Error(`No Codex App backup found at ${manifestPath}.`);
  }

  const manifest = JSON.parse(raw) as BackupManifest;
  for (const entry of manifest.files) {
    if (entry.existed) {
      if (!entry.backupPath) {
        throw new Error(`Backup manifest is missing backupPath for ${entry.path}.`);
      }
      await mkdir(path.dirname(entry.path), { recursive: true });
      await copyFile(entry.backupPath, entry.path);
    } else {
      await rm(entry.path, { force: true });
    }
  }
  await rm(modelCatalogPath(home), { force: true });
  await rm(appSessionLockPath(home), { force: true });

  try {
    const authToken = await localProxyAuthToken();
    const { url } = await ensureDaemon();
    await daemonFetch(`${url}/internal/sessions/${encodeURIComponent(codexAppSessionToken(authToken))}`, { method: "DELETE" });
  } catch {
    // Restore should still succeed if the daemon is not reachable.
  }

  const launch = await launchCodexApp({ reason: "restored", openIfClosed: false });
  return {
    message: [
      "Codex App restored to your previous profile.",
      `Backup date: ${manifest.createdAt}`,
      codexAppLaunchMessage(launch),
    ].join("\n"),
  };
}

async function backupFiles(home: string, files: string[]): Promise<string> {
  const dir = backupDir(home);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const snapshotDir = path.join(dir, stamp);
  await mkdir(snapshotDir, { recursive: true });
  const entries: BackupEntry[] = [];
  for (const file of files) {
    if (await exists(file)) {
      const backupPath = path.join(snapshotDir, backupNameFor(file));
      await mkdir(path.dirname(backupPath), { recursive: true });
      await copyFile(file, backupPath);
      entries.push({ path: file, backupPath, existed: true });
    } else {
      entries.push({ path: file, existed: false });
    }
  }
  const manifest: BackupManifest = { createdAt: new Date().toISOString(), files: entries };
  await writeTextAtomic(path.join(dir, BACKUP_MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
  return snapshotDir;
}

async function backupCodexAppConfig(home: string, configPath: string): Promise<string> {
  const manifestPath = path.join(backupDir(home), BACKUP_MANIFEST);
  if (await isManagedCodexAppConfig(home)) {
    const existing = await readTextIfExists(manifestPath);
    if (existing) {
      try {
        const manifest = JSON.parse(existing) as BackupManifest;
        if (manifest.files.some((entry) => entry.path === configPath)) {
          return path.dirname(manifest.files.find((entry) => entry.path === configPath)?.backupPath ?? manifestPath);
        }
      } catch {
        // Fall through and create a fresh backup if the manifest is invalid.
      }
    }
  }
  return backupFiles(home, [configPath]);
}

async function writePersistentModelCatalog(home: string): Promise<string> {
  const file = modelCatalogPath(home);
  await writeTextAtomic(file, `${codexAppModelCatalogJson()}\n`);
  return file;
}

export function codexAppModelCatalogJson(): string {
  return JSON.stringify({
    models: CODEX_SUPPORTED_MODELS.map(({ definition }, index) => codexAppCatalogEntry(definition, index)),
  });
}

function codexAppCatalogEntry(model: ModelDefinition, priority: number): Record<string, unknown> {
  return {
    slug: model.id,
    display_name: model.name,
    description: `Together AI model via togetherlink (${model.name})`,
    default_reasoning_level: null,
    supported_reasoning_levels: [],
    shell_type: "default",
    visibility: "list",
    supported_in_api: true,
    priority,
    additional_speed_tiers: [],
    availability_nux: null,
    upgrade: null,
    base_instructions: codexAppBaseInstructions(),
    model_messages: null,
    supports_reasoning_summaries: model.reasoning,
    default_reasoning_summary: model.reasoning ? "auto" : "none",
    support_verbosity: false,
    default_verbosity: null,
    apply_patch_tool_type: null,
    web_search_tool_type: "text",
    truncation_policy: { mode: "bytes", limit: 10_000 },
    supports_parallel_tool_calls: false,
    supports_image_detail_original: false,
    context_window: model.limit.context,
    max_context_window: model.limit.context,
    auto_compact_token_limit: null,
    effective_context_window_percent: 95,
    experimental_supported_tools: [],
    input_modalities: model.modalities.input,
    supports_search_tool: false,
  };
}

function codexAppBaseInstructions(): string {
  return "You are Codex, a coding agent. You and the user share the same workspace and collaborate to achieve the user's goals.";
}

type CodexAppLaunchResult = {
  launched: boolean;
  launchAttempted: boolean;
  wasRunning: boolean;
  restarted: boolean;
  restartDeclined: boolean;
  restartUnsupported: boolean;
};

type CodexAppLaunchReason = "configured" | "restored";

async function launchCodexApp(options: { reason: CodexAppLaunchReason; openIfClosed: boolean }): Promise<CodexAppLaunchResult> {
  const wasRunning = await isCodexAppRunning();
  let restarted = false;
  let restartDeclined = false;
  let restartUnsupported = false;

  if (wasRunning) {
    if (await shouldRestartCodexApp(options.reason)) {
      restarted = await quitCodexApp();
      restartUnsupported = !restarted;
    } else {
      restartDeclined = true;
    }
  }

  const launchAttempted = !(restartDeclined || restartUnsupported || !options.openIfClosed);
  const launched = launchAttempted ? await openCodexApp() : false;
  return { launched, launchAttempted, wasRunning, restarted, restartDeclined, restartUnsupported };
}

function codexAppLaunchMessage(result: CodexAppLaunchResult): string {
  if (result.wasRunning && result.restarted && result.launched) {
    return "Codex App was already open; restart approved and relaunch requested.";
  }
  if (result.wasRunning && result.restartDeclined) {
    return "Codex App is already open. Restart it when you are ready so it reloads this profile.";
  }
  if (result.wasRunning && result.restartUnsupported) {
    return "Codex App is already open, but togetherlink could not restart it. Quit and reopen Codex App when you are ready.";
  }
  if (!result.wasRunning && !result.launchAttempted) {
    return "Codex App was not running.";
  }
  return result.launched
    ? "Codex App launch requested."
    : "Config written, but Codex App could not be launched automatically. Open Codex App manually.";
}

async function shouldRestartCodexApp(reason: CodexAppLaunchReason): Promise<boolean> {
  if (!isInteractive()) {
    return false;
  }
  const clack = await import("@clack/prompts");
  const action = reason === "restored" ? "reload your restored Codex profile" : "reload the Togetherlink profile";
  const restart = await clack.confirm({
    message: `Codex App is already open. Restart it now to ${action}?`,
    initialValue: false,
  });
  return restart === true;
}

async function openCodexApp(): Promise<boolean> {
  const launchedViaCodex = await spawnDetached("codex", ["app", process.cwd()]);
  if (launchedViaCodex) {
    return true;
  }
  if (process.platform === "darwin") {
    return spawnDetached("open", ["-a", "Codex", process.cwd()]);
  }
  if (process.platform === "win32") {
    return spawnDetached("cmd", ["/c", "start", "", "Codex"]);
  }
  return false;
}

async function isCodexAppRunning(): Promise<boolean> {
  if (process.platform === "darwin") {
    try {
      const { stdout } = await execFileAsync("/usr/bin/osascript", ["-e", 'application "Codex" is running']);
      return stdout.trim() === "true";
    } catch {
      return false;
    }
  }
  if (process.platform === "win32") {
    try {
      const { stdout } = await execFileAsync("tasklist", ["/FI", "IMAGENAME eq Codex.exe"]);
      return /\bCodex\.exe\b/i.test(stdout);
    } catch {
      return false;
    }
  }
  return false;
}

async function quitCodexApp(): Promise<boolean> {
  if (process.platform === "darwin") {
    try {
      await execFileAsync("/usr/bin/osascript", ["-e", 'tell application "Codex" to quit']);
      return waitForCodexAppExit();
    } catch {
      return false;
    }
  }
  if (process.platform === "win32") {
    try {
      await execFileAsync("taskkill", ["/IM", "Codex.exe"]);
      return waitForCodexAppExit();
    } catch {
      return false;
    }
  }
  return false;
}

async function waitForCodexAppExit(): Promise<boolean> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (!(await isCodexAppRunning())) {
      return true;
    }
    await sleep(200);
  }
  return false;
}

async function spawnDetached(command: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
    });
    child.once("error", () => resolve(false));
    child.once("spawn", () => {
      child.unref();
      resolve(true);
    });
  });
}

function codexConfigPath(home: string): string {
  return path.join(home, ".codex", "config.toml");
}

function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backupDir(home: string): string {
  return path.join(process.env.TOGETHERLINK_HOME || path.join(home, ".togetherlink"), "backup", "codex-app");
}

function modelCatalogPath(home: string): string {
  return path.join(home, ".codex", "togetherlink-codex-app-models.json");
}

function appSessionLockPath(home: string): string {
  return path.join(process.env.TOGETHERLINK_HOME || path.join(home, ".togetherlink"), "codex-app", "session.json");
}

function codexAppSessionToken(authToken: string): string {
  return authToken;
}

function backupNameFor(file: string): string {
  return file.replace(/^[a-zA-Z]:/, "").split(path.sep).filter(Boolean).join("__") || "file";
}

async function readTextIfExists(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, "utf8");
  } catch (err) {
    if (isNodeError(err) && err.code === "ENOENT") {
      return undefined;
    }
    throw err;
  }
}

async function writeTextAtomic(file: string, value: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  await writeFile(tmp, value, { encoding: "utf8", mode: 0o600 });
  await rename(tmp, file);
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readAppSessionLock(home: string): Promise<CodexAppSessionLock | undefined> {
  const raw = await readTextIfExists(appSessionLockPath(home));
  if (!raw) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as CodexAppSessionLock;
    if (typeof parsed.pid === "number" && typeof parsed.sessionToken === "string") {
      return parsed;
    }
  } catch {
    // Invalid lock files are treated as stale and overwritten by the next session.
  }
  return undefined;
}

async function writeAppSessionLock(home: string, lock: CodexAppSessionLock): Promise<void> {
  await writeTextAtomic(appSessionLockPath(home), `${JSON.stringify(lock, null, 2)}\n`);
}

async function assertNoLiveCodexAppSession(home: string): Promise<void> {
  const lock = await readAppSessionLock(home);
  if (!lock || lock.pid === process.pid || !isProcessAlive(lock.pid)) {
    return;
  }
  throw new Error(
    `Another togetherlink codex-app session appears to be running (pid ${lock.pid}). Stop it with Ctrl+C, or run \`togetherlink codex-app --restore\` after it exits.`,
  );
}

async function recoverInterruptedCodexApp(home: string): Promise<boolean> {
  const lock = await readAppSessionLock(home);
  if (lock && lock.pid !== process.pid && isProcessAlive(lock.pid)) {
    return false;
  }
  if (!lock && !(await isManagedCodexAppConfig(home))) {
    return false;
  }
  try {
    await restoreCodexApp(home);
    return true;
  } catch {
    return false;
  }
}

async function isManagedCodexAppConfig(home: string): Promise<boolean> {
  const raw = await readTextIfExists(codexConfigPath(home));
  if (!raw) {
    return false;
  }
  if (raw.includes(CODEX_APP_CONFIG_MARKER_START)) {
    return true;
  }
  return raw.includes('model_provider = "openai"')
    && raw.includes('openai_base_url = "http://127.0.0.1:')
    && raw.includes(modelCatalogPath(home));
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

function removeManagedBlock(raw: string): string {
  const start = raw.indexOf(CODEX_APP_CONFIG_MARKER_START);
  if (start < 0) {
    return raw;
  }
  const end = raw.indexOf(CODEX_APP_CONFIG_MARKER_END, start);
  if (end < 0) {
    return raw;
  }
  const afterEnd = end + CODEX_APP_CONFIG_MARKER_END.length;
  return `${raw.slice(0, start).trimEnd()}\n${raw.slice(afterEnd).replace(/^\s*\n/, "")}`;
}

function removeTomlSections(raw: string, sectionNames: string[]): string {
  if (sectionNames.length === 0 || raw.trim() === "") {
    return raw;
  }
  const remove = new Set(sectionNames.map((section) => `[${section}]`));
  const lines = raw.split("\n");
  const kept: string[] = [];
  let skipping = false;

  for (const line of lines) {
    if (/^\s*\[/.test(line)) {
      skipping = remove.has(line.trim());
    }
    if (!skipping) {
      kept.push(line);
    }
  }

  return kept.join("\n").replace(/\n{3,}/g, "\n\n");
}

function splitTomlPreamble(raw: string): [string, string] {
  const match = raw.match(/(?:^|\n)\s*\[/);
  if (!match || match.index === undefined) {
    return [raw, ""];
  }
  const tableStart = match[0].startsWith("\n") ? match.index + 1 : match.index;
  return [raw.slice(0, tableStart), raw.slice(tableStart)];
}

function upsertTopLevelTomlKeys(preamble: string, values: Record<string, string>): string {
  const seen = new Set<string>();
  const lines = preamble.split(/\n/);
  const next = lines.map((line) => {
    const match = /^(\s*)([A-Za-z0-9_-]+)(\s*=\s*)(.*)$/.exec(line);
    if (!match) {
      return line;
    }
    const key = match[2];
    if (!key) {
      return line;
    }
    const value = values[key];
    if (value === undefined) {
      return line;
    }
    seen.add(key);
    return `${match[1] ?? ""}${key}${match[3] ?? " = "}${value}`;
  });
  const insertion = Object.entries(values)
    .filter(([key]) => !seen.has(key))
    .map(([key, value]) => `${key} = ${value}`);
  const compact = next.join("\n").trimEnd();
  const prefix = compact ? `${compact}\n` : "";
  return `${prefix}${insertion.join("\n")}${insertion.length > 0 ? "\n" : ""}`;
}

function removeTopLevelTomlKeys(preamble: string, keys: string[]): string {
  const remove = new Set(keys);
  return preamble
    .split(/\n/)
    .filter((line) => {
      const match = /^(\s*)([A-Za-z0-9_-]+)(\s*=\s*)(.*)$/.exec(line);
      return !match || !remove.has(match[2] ?? "");
    })
    .join("\n");
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}

export const CODEX_APP_ALPHA_STATUS = {
  providerId: CODEX_APP_PROVIDER_ID,
  defaultModel: CODEX_DEFAULT_MODEL,
};
