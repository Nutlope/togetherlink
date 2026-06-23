import os from "node:os";
import path from "node:path";
import {
  readJsonIfExists,
  writeJsonAtomic,
  snapshotIfMissing,
  restoreSnapshot,
} from "./together-core.js";
import { togetherlinkHome } from "./global-config.js";
import type { HarnessContext } from "./harness-types.js";

export const OPENCODE_PROVIDER_ID = "togetherai";

export type OpencodePaths = {
  configPath: string;
  authPath: string;
  dataDir: string;
};

type OpencodePathContext = Partial<Pick<HarnessContext, "home">> & {
  configPath?: string;
  authPath?: string;
};

type OpencodeConfig = {
  $schema?: string;
  model?: string;
  provider?: Record<string, Record<string, unknown>>;
};

type OpencodeAuth = Record<string, { type?: string; key?: string } | undefined>;

type EnableTogetherOpencodeOptions = OpencodePaths & {
  apiKey: string;
  modelId: string;
};

type DisableTogetherOpencodeOptions = OpencodePaths & {
  wasEnabled: boolean;
};

export function opencodePathsFor(ctx: OpencodePathContext = {}): OpencodePaths {
  const home = ctx.home ?? os.homedir();
  const configHome = process.env.XDG_CONFIG_HOME || path.join(home, ".config");
  const dataHome = process.env.XDG_DATA_HOME || path.join(home, ".local", "share");
  return {
    configPath: ctx.configPath ?? path.join(configHome, "opencode", "opencode.json"),
    authPath: ctx.authPath ?? path.join(dataHome, "opencode", "auth.json"),
    dataDir: path.join(togetherlinkHome(home), "opencode"),
  };
}

export function opencodeProviderStatus(config: OpencodeConfig): "none" | "together" | "configured-not-default" {
  if (!config.provider?.[OPENCODE_PROVIDER_ID]) {
    return "none";
  }
  return typeof config.model === "string" && config.model.startsWith(`${OPENCODE_PROVIDER_ID}:`)
    ? "together"
    : "configured-not-default";
}

export function opencodeCurrentModelId(config: OpencodeConfig): string | null {
  if (typeof config.model !== "string" || !config.model.startsWith(`${OPENCODE_PROVIDER_ID}:`)) {
    return null;
  }
  return config.model.slice(`${OPENCODE_PROVIDER_ID}:`.length);
}

/**
 * Registers Together as one more OpenCode provider — additive, other
 * providers in `provider`/other models in `auth.json` are left untouched.
 * Uses the first-party `@ai-sdk/togetherai` adapter, which already knows
 * Together's base URL internally (no custom baseURL/options block needed).
 */
export async function enableTogetherOpencode({
  configPath,
  authPath,
  dataDir,
  apiKey,
  modelId,
}: EnableTogetherOpencodeOptions): Promise<{ model: string }> {
  await snapshotIfMissing(dataDir, "config", configPath);
  await snapshotIfMissing(dataDir, "auth", authPath);

  const config = await readJsonIfExists<OpencodeConfig>(configPath);
  config.$schema ??= "https://opencode.ai/config.json";
  config.provider = {
    ...(config.provider ?? {}),
    [OPENCODE_PROVIDER_ID]: {
      ...(config.provider?.[OPENCODE_PROVIDER_ID] ?? {}),
      npm: "@ai-sdk/togetherai",
      name: "Together AI",
    },
  };
  config.model = `${OPENCODE_PROVIDER_ID}:${modelId}`;
  await writeJsonAtomic(configPath, config);

  const auth = await readJsonIfExists<OpencodeAuth>(authPath);
  auth[OPENCODE_PROVIDER_ID] = { type: "api", key: apiKey };
  await writeJsonAtomic(authPath, auth);

  return { model: config.model };
}

export async function disableTogetherOpencode({
  configPath,
  authPath,
  dataDir,
  wasEnabled,
}: DisableTogetherOpencodeOptions): Promise<"not-active" | "restored"> {
  if (!wasEnabled) {
    return "not-active";
  }
  const restoredConfig = await restoreSnapshot(dataDir, "config", configPath);
  const restoredAuth = await restoreSnapshot(dataDir, "auth", authPath);
  return restoredConfig || restoredAuth ? "restored" : "not-active";
}
