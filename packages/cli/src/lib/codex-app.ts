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
import { resolveTogetherApiKey, resolveTogetherBaseUrl } from "./together-core.js";
import {
  removeManagedBlock as tomlRemoveManagedBlock,
  removeTomlSections,
  splitTomlPreamble,
  insertTopLevelTomlKeys,
  upsertTopLevelTomlKeys,
  removeTopLevelTomlKeys,
  tomlString,
} from "./codex-app/toml.js";
import {
  type CodexAppSessionLock,
  appSessionLockPath,
  writeAppSessionLock,
  isManagedCodexAppConfig,
} from "./codex-app/session-lock.js";
import {
  type CodexAppLaunchResult,
  type CodexAppLaunchReason,
  launchCodexApp,
  codexAppLaunchMessage,
} from "./codex-app/process.js";
import { writeMergedCodexAppCatalog, mergedCodexAppCatalogJson } from "./codex-app/catalog.js";
import { DEFAULT_CODEX_NATIVE_BASE_URL, nativeCodexBaseUrl } from "./codex/native-router.js";
import type { CodexModelCatalog } from "./codex/catalog.js";

const CODEX_APP_PROVIDER_ID = `${CODEX_PROVIDER_ID}_codex_app`;
const CODEX_APP_CONFIG_MARKER_START = "# >>> togetherlink codex-app alpha >>>";
const CODEX_APP_CONFIG_MARKER_END = "# <<< togetherlink codex-app alpha <<<";
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
  const configPath = codexConfigPath(ctx.home);
  const currentConfig = (await readTextIfExists(configPath)) ?? "";
  const configBase = await originalCodexAppConfig(ctx.home, configPath, currentConfig);
  const nativeBaseUrl = nativeCodexBaseUrl(configBase);
  const { url: proxyUrl } = await ensureDaemon();
  const agentProxyUrl = daemonSessionUrl(proxyUrl, sessionToken);
  const { path: catalogPath, modelCount } = await writePersistentModelCatalog(ctx.home);

  const registration: RegisterSessionRequest = {
    token: sessionToken,
    authToken,
    agent: "codex-app",
    apiKey,
    baseUrl: resolveTogetherBaseUrl(),
    modelLabel: `${selectedModel.definition.name} (ChatGPT App alpha)`,
    modelId: selectedModel.definition.id,
    targetModelId: selectedModel.definition.id,
    modelName: selectedModel.definition.name,
    modelDefinition: selectedModel.definition,
    nativeBaseUrl,
    ...(process.env.TOGETHERLINK_DEBUG === "1" ? { debug: true } : {}),
  };
  await registerDaemonSession(proxyUrl, registration);
  // This command exits after configuring, so no launcher stays alive to
  // re-register the session. Persist the register body so the daemon can
  // rebuild the session on demand (restart, idle reap) from disk.
  await writeAppRegistration(registration, togetherlinkHomeDir(ctx.home));

  const backup = await backupCodexAppConfig(ctx.home, configPath);
  const next = buildCodexAppConfig(configBase, {
    ...(ctx.main ? { modelId: selectedModel.definition.id } : {}),
    providerId: CODEX_APP_PROVIDER_ID,
    providerName: "Togetherlink",
    baseUrl: `${agentProxyUrl}/v1`,
    bearerToken: authToken,
    catalogPath,
    nativeBaseUrl,
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
      additiveModelRouter: true,
      catalogModelCount: modelCount,
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
    "Together AI models added to the ChatGPT App picker. (alpha)",
    ctx.main
      ? `Default model changed to: ${selectedModel.definition.name}`
      : `Native GPT default preserved; Together default available: ${selectedModel.definition.name}`,
    "Start a task or open a repository in ChatGPT App as usual.",
    "Restore your previous ChatGPT App profile with: togetherlink chatgpt --restore",
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
    modelId?: string;
    providerId: string;
    providerName: string;
    baseUrl: string;
    bearerToken: string;
    catalogPath: string;
    nativeBaseUrl?: string;
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
    // A short-lived TogetherLink build tried to disable Responses WebSockets
    // by overriding the built-in provider. Current Codex reserves this ID and
    // rejects the entire config if that table remains, so clean it up while
    // retaining the supported HTTP 426 transport fallback in the daemon.
    "model_providers.openai",
    'model_providers."openai"',
  ]);
  const withGenericDefaults = applyCodexGenericUserDefaults(withoutLegacyTables);
  const [preamble, rest] = splitTomlPreamble(withGenericDefaults);
  const managedValues: Record<string, string> = {
    // Per-model context windows live in the generated model catalog; do not
    // emit global `model_context_window`/`model_auto_compact_token_limit`
    // overrides here. A global override is tied to whichever model was
    // selected when this config was written, so switching models inside
    // ChatGPT Desktop leaves the override stale and clamps the displayed
    // context length (e.g. every 262k model gets stuck at ~249k).
    openai_base_url: tomlString(options.baseUrl),
    model_catalog_json: tomlString(options.catalogPath),
  };
  if (options.modelId) managedValues.model = tomlString(options.modelId);
  const managedPreamble = upsertTopLevelTomlKeys(preamble, managedValues);
  const withNativeRealtime = insertTopLevelTomlKeys(managedPreamble, {
    // `openai_base_url` intentionally points at the Responses router. Voice
    // and realtime traffic must stay on OpenAI's native endpoints.
    experimental_realtime_webrtc_call_base_url: tomlString(
      options.nativeBaseUrl ?? DEFAULT_CODEX_NATIVE_BASE_URL,
    ),
    experimental_realtime_ws_base_url: tomlString("https://api.openai.com/v1"),
  });
  const cleanedPreamble = removeTopLevelTomlKeys(withNativeRealtime, [
    "profile",
    // Strip legacy global context-window overrides that were emitted by early
    // versions of the togetherlink managed config. They become stale the
    // moment the user switches models inside ChatGPT Desktop.
    "model_context_window",
    "model_auto_compact_token_limit",
  ]);
  const providerBlock = [
    CODEX_APP_CONFIG_MARKER_START,
    "# TogetherLink keeps the built-in OpenAI provider active and routes by model slug.",
    `[model_providers.${options.providerId}]`,
    `name = ${tomlString(options.providerName)}`,
    `base_url = ${tomlString(options.baseUrl)}`,
    'wire_api = "responses"',
    "# This table is inert while model_provider remains openai; it documents the",
    "# local external-model route without replacing ChatGPT authentication.",
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
    throw new Error(`No ChatGPT App backup found at ${manifestPath}.`);
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
  await rm(nativeModelCatalogPath(home), { force: true });
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
      "ChatGPT App restored to your previous profile.",
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

/**
 * Migrate the old replacement-provider setup from its preserved pre-Together
 * backup. Building the additive config on top of the old managed file would
 * leave `model_provider = togetherlink_codex_app` selected and still hide GPT.
 */
async function originalCodexAppConfig(
  home: string,
  configPath: string,
  current: string,
): Promise<string> {
  if (
    !(await isManagedCodexAppConfig(
      home,
      configPath,
      CODEX_APP_CONFIG_MARKER_START,
      modelCatalogPath(home),
    ))
  ) {
    return current;
  }
  const rawManifest = await readTextIfExists(path.join(backupDir(home), BACKUP_MANIFEST));
  if (!rawManifest) return current;
  try {
    const manifest = JSON.parse(rawManifest) as BackupManifest;
    const entry = manifest.files.find((candidate) => candidate.path === configPath);
    if (entry?.existed && entry.backupPath) {
      return (await readTextIfExists(entry.backupPath)) ?? current;
    }
    return entry && !entry.existed ? "" : current;
  } catch {
    return current;
  }
}

async function writePersistentModelCatalog(
  home: string,
): Promise<{ path: string; modelCount: number }> {
  const file = modelCatalogPath(home);
  const modelCount = await writeMergedCodexAppCatalog(home, file, nativeModelCatalogPath(home));
  return { path: file, modelCount };
}

export function codexAppModelCatalogJson(nativeCatalog?: CodexModelCatalog): string {
  return nativeCatalog ? mergedCodexAppCatalogJson(nativeCatalog) : codexModelCatalogJson();
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

function nativeModelCatalogPath(home: string): string {
  return path.join(home, ".codex", "togetherlink-codex-app-native-models.json");
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

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}

export const CODEX_APP_ALPHA_STATUS = {
  providerId: CODEX_APP_PROVIDER_ID,
  defaultModel: CODEX_DEFAULT_MODEL,
};
