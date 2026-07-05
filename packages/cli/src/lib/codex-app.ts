import { constants as fsConstants } from "node:fs";
import { access, copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { CODEX_DEFAULT_MODEL, CODEX_PROVIDER_ID, resolveCodexModel } from "./codex/defaults.js";
import { codexModelCatalogJson } from "./codex/catalog.js";
import { applyCodexGenericUserDefaults } from "./codex/user-config.js";
import { clearAppRegistration, writeAppRegistration } from "./daemon/app-registration.js";
import {
  daemonFetch,
  daemonSessionUrl,
  ensureDaemon,
  localProxyAuthToken,
  registerDaemonSession,
} from "./daemon/launch.js";
import type { RegisterSessionRequest } from "./daemon/state.js";
import type { HarnessContext, HarnessResult } from "./harness-types.js";
import { sendTelemetryEvent } from "./telemetry.js";
import { resolveTogetherApiKey } from "./together-core.js";
import { isProcessAlive } from "./paths.js";
import {
  removeManagedBlock as tomlRemoveManagedBlock,
  removeTomlSections,
  splitTomlPreamble,
  upsertTopLevelTomlKeys,
  removeTopLevelTomlKeys,
  tomlString,
} from "./codex-app/toml.js";
import {
  type CodexAppSessionLock,
  appSessionLockPath,
  readAppSessionLock,
  writeAppSessionLock,
  assertNoLiveCodexAppSession,
  isManagedCodexAppConfig,
} from "./codex-app/session-lock.js";
import {
  type CodexAppLaunchResult,
  type CodexAppLaunchReason,
  launchCodexApp,
  codexAppLaunchMessage,
} from "./codex-app/process.js";

const CODEX_APP_PROVIDER_ID = `${CODEX_PROVIDER_ID}_codex_app`;
const CODEX_APP_CONFIG_MARKER_START = "# >>> togetherlink codex-app alpha >>>";
const CODEX_APP_CONFIG_MARKER_END = "# <<< togetherlink codex-app alpha <<<";
const CODEX_APP_REQUIRES_OPENAI_AUTH_WORKAROUND = true;
const BACKUP_MANIFEST = "latest.json";

type BackupEntry = {
  path: string;
  backupPath?: string;
  existed: boolean;
};

type BackupManifest = {
  createdAt: string;
  files: BackupEntry[];
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
    throw new Error(
      "No Together API key found. Pass --api-key, run `togetherlink configure`, or set TOGETHER_API_KEY.",
    );
  }

  const selectedModel = resolveCodexModel(ctx.main);
  const authToken = await localProxyAuthToken();
  const sessionToken = codexAppSessionToken(authToken);
  const telemetrySessionId = sessionToken;
  const startedAt = Date.now();
  const { url: proxyUrl } = await ensureDaemon();
  const agentProxyUrl = daemonSessionUrl(proxyUrl, sessionToken);
  const catalogPath = await writePersistentModelCatalog(ctx.home);

  const registration: RegisterSessionRequest = {
    token: sessionToken,
    authToken,
    agent: "codex-app",
    apiKey,
    modelLabel: `${selectedModel.definition.name} (Codex App alpha)`,
    modelId: selectedModel.definition.id,
    targetModelId: selectedModel.definition.id,
    modelName: selectedModel.definition.name,
    modelDefinition: selectedModel.definition,
    ...(process.env.TOGETHERLINK_DEBUG === "1" ? { debug: true } : {}),
  };
  await registerDaemonSession(proxyUrl, registration);
  // This command exits after configuring, so no launcher stays alive to
  // re-register the session. Persist the register body so the daemon can
  // rebuild the session on demand (restart, idle reap) from disk.
  await writeAppRegistration(registration, togetherlinkHomeDir(ctx.home));

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
  });
  await writeTextAtomic(configPath, next);
  // Codex caches remote model metadata in models_cache.json. If a previous
  // run populated it with OpenAI's catalog, Codex can keep serving stale model
  // metadata and show "Custom model from config". Bust the cache so the next
  // Codex launch refetches against the active provider/config.
  await bustStaleModelsCache(ctx.home);
  await writeAppSessionLock(ctx.home, {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    sessionToken,
    configPath,
    catalogPath,
  });

  const launch = await launchCodexApp({ reason: "configured", openIfClosed: true });
  void sendTelemetryEvent({
    event: "session_started",
    sessionId: telemetrySessionId,
    agent: "codex-app",
    initialModel: selectedModel.definition.id,
    startedAt,
    metadata: {
      integration: "codex-app",
      providerId: CODEX_APP_PROVIDER_ID,
      providerAuthWorkaround: CODEX_APP_REQUIRES_OPENAI_AUTH_WORKAROUND,
      workaroundIssue: "openai/codex#10867",
      catalogModelCount: codexAppModelCatalogCount(),
      proxySessionRegistered: true,
      launchAttempted: launch.launchAttempted,
      launched: launch.launched,
      wasRunning: launch.wasRunning,
      restarted: launch.restarted,
      restartDeclined: launch.restartDeclined,
      restartUnsupported: launch.restartUnsupported,
    },
  });
  const intro = [
    "Codex App profile changed to Togetherlink. (alpha)",
    `Model: ${selectedModel.definition.name}`,
    "Start a task or open a repository in Codex App as usual.",
    "Restore your previous Codex App profile with: togetherlink codex-app --restore",
    `Backup: ${backup}`,
    codexAppLaunchMessage(launch),
  ]
    .filter(Boolean)
    .join("\n");

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
  },
): string {
  const withoutManagedBlock = tomlRemoveManagedBlock(
    rawConfig,
    CODEX_APP_CONFIG_MARKER_START,
    CODEX_APP_CONFIG_MARKER_END,
  );
  const withoutLegacyTables = removeTomlSections(withoutManagedBlock, [
    `profiles.${options.providerId}`,
    `profiles."${options.providerId}"`,
    `model_providers.${options.providerId}`,
    `model_providers."${options.providerId}"`,
  ]);
  const withGenericDefaults = applyCodexGenericUserDefaults(withoutLegacyTables);
  const [preamble, rest] = splitTomlPreamble(withGenericDefaults);
  const managedPreamble = upsertTopLevelTomlKeys(preamble, {
    // Per-model context windows live in the generated model catalog; do not
    // emit global `model_context_window`/`model_auto_compact_token_limit`
    // overrides here. A global override is tied to whichever model was
    // selected when this config was written, so switching models inside
    // Codex Desktop leaves the override stale and clamps the displayed
    // context length (e.g. every 262k model gets stuck at ~249k).
    model: tomlString(options.modelId),
    model_provider: tomlString(options.providerId),
    model_catalog_json: tomlString(options.catalogPath),
  });
  const cleanedPreamble = removeTopLevelTomlKeys(managedPreamble, [
    "model_reasoning_effort",
    "openai_base_url",
    "profile",
    // Strip legacy global context-window overrides that were emitted by early
    // versions of the togetherlink managed config. They become stale the
    // moment the user switches models inside Codex Desktop.
    "model_context_window",
    "model_auto_compact_token_limit",
  ]);
  const providerBlock = [
    CODEX_APP_CONFIG_MARKER_START,
    "# togetherlink codex-app configures a dedicated alpha provider for Codex Desktop.",
    `[model_providers.${options.providerId}]`,
    `name = ${tomlString(options.providerName)}`,
    `base_url = ${tomlString(options.baseUrl)}`,
    'wire_api = "responses"',
    "# Codex Desktop currently gates its model picker on provider auth state.",
    "# Setting this true is a Desktop workaround for custom providers; the",
    "# actual model requests still go to the local Togetherlink base_url above.",
    "# See https://github.com/openai/codex/issues/10867",
    `requires_openai_auth = ${CODEX_APP_REQUIRES_OPENAI_AUTH_WORKAROUND ? "true" : "false"}`,
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
  // Drop the persisted registration so the daemon stops lazily resurrecting
  // the codex-app session after the user restores their original profile.
  await clearAppRegistration(togetherlinkHomeDir(home));
  // Restore should also drop the models cache: a stale OpenAI-only cache left
  // behind by a togetherlink session would make Codex show "Unknown model"
  // warnings for the user's real (restored) model until the cache expires.
  await bustStaleModelsCache(home);

  try {
    const authToken = await localProxyAuthToken();
    const { url } = await ensureDaemon();
    await daemonFetch(
      `${url}/internal/sessions/${encodeURIComponent(codexAppSessionToken(authToken))}`,
      { method: "DELETE" },
    );
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
  if (
    await isManagedCodexAppConfig(
      home,
      codexConfigPath(home),
      CODEX_APP_CONFIG_MARKER_START,
      modelCatalogPath(home),
    )
  ) {
    const existing = await readTextIfExists(manifestPath);
    if (existing) {
      try {
        const manifest = JSON.parse(existing) as BackupManifest;
        if (manifest.files.some((entry) => entry.path === configPath)) {
          return path.dirname(
            manifest.files.find((entry) => entry.path === configPath)?.backupPath ?? manifestPath,
          );
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
  return codexModelCatalogJson();
}

function codexAppModelCatalogCount(): number {
  try {
    const parsed = JSON.parse(codexAppModelCatalogJson()) as { models?: unknown[] };
    return Array.isArray(parsed.models) ? parsed.models.length : 0;
  } catch {
    return 0;
  }
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
  return path.join(
    process.env.TOGETHERLINK_HOME || path.join(home, ".togetherlink"),
    "backup",
    "codex-app",
  );
}

function modelCatalogPath(home: string): string {
  return path.join(home, ".codex", "togetherlink-codex-app-models.json");
}

/**
 * Codex caches the remote /v1/models response at ~/.codex/models_cache.json.
 * If that cache was populated by OpenAI/ChatGPT routing, it holds OpenAI's
 * catalog (gpt-5.x) instead of our proxy's models. Codex can then log
 * "Unknown model <id> is used. This will use fallback model metadata." and
 * show "Custom model from config". Removing the stale cache forces the next
 * Codex launch to refetch from the active provider/config. Safe to no-op if
 * the file is absent.
 */
async function bustStaleModelsCache(home: string): Promise<void> {
  const cachePath = path.join(home, ".codex", "models_cache.json");
  try {
    await rm(cachePath, { force: true });
  } catch {
    // Best-effort: a missing or locked file is fine; Codex will re-evaluate.
  }
}

function togetherlinkHomeDir(home: string): string {
  return process.env.TOGETHERLINK_HOME || path.join(home, ".togetherlink");
}

function codexAppSessionToken(authToken: string): string {
  return authToken;
}

function backupNameFor(file: string): string {
  return (
    file
      .replace(/^[a-zA-Z]:/, "")
      .split(path.sep)
      .filter(Boolean)
      .join("__") || "file"
  );
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

async function recoverInterruptedCodexApp(home: string): Promise<boolean> {
  const lock = await readAppSessionLock(home);
  if (lock && lock.pid !== process.pid && isProcessAlive(lock.pid)) {
    return false;
  }
  if (
    !lock &&
    !(await isManagedCodexAppConfig(
      home,
      codexConfigPath(home),
      CODEX_APP_CONFIG_MARKER_START,
      modelCatalogPath(home),
    ))
  ) {
    return false;
  }
  try {
    await restoreCodexApp(home);
    return true;
  } catch {
    return false;
  }
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}

export const CODEX_APP_ALPHA_STATUS = {
  providerId: CODEX_APP_PROVIDER_ID,
  defaultModel: CODEX_DEFAULT_MODEL,
};
