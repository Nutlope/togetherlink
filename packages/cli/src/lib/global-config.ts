import os from "node:os";
import path from "node:path";
import { readJsonIfExists, writeJsonAtomic, TOGETHER_API_KEY_ENV_REF } from "./together-core.js";

export type GlobalConfig = {
  apiKey: string;
};

export function togetherlinkHome(home = os.homedir()): string {
  return path.join(home, ".togetherlink");
}

function globalConfigPath(home = os.homedir()): string {
  return path.join(togetherlinkHome(home), "config.json");
}

export async function readGlobalConfig(home = os.homedir()): Promise<GlobalConfig> {
  const config = await readJsonIfExists<Partial<GlobalConfig>>(globalConfigPath(home));
  return {
    apiKey: config.apiKey ?? "",
  };
}

export async function writeGlobalConfig(home: string, config: GlobalConfig): Promise<void> {
  await writeJsonAtomic(globalConfigPath(home), config);
}

export async function setGlobalApiKey(home: string, apiKey: string): Promise<void> {
  const config = await readGlobalConfig(home);
  config.apiKey = apiKey;
  await writeGlobalConfig(home, config);
}

/**
 * Resolves a stored key value to the literal secret. Stored values are
 * either a literal key or the `{env:TOGETHER_API_KEY}` reference written
 * when the key came from the environment rather than `--api-key`.
 */
export function resolveStoredApiKey(stored: string | undefined): string {
  if (!stored) {
    return "";
  }
  if (stored === TOGETHER_API_KEY_ENV_REF) {
    return process.env.TOGETHER_API_KEY?.trim() ?? "";
  }
  return stored;
}