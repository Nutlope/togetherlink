import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import type { HarnessContext } from "./harness-types.js";

export const TOGETHER_BASE_URL = "https://api.together.ai/v1";
export const TOGETHER_API_KEY_ENV_REF = "{env:TOGETHER_API_KEY}";
export const EXA_API_KEY_ENV_REF = "{env:EXA_API_KEY}";

export type JsonObject = Record<string, unknown>;

export async function readJsonIfExists<T extends JsonObject = JsonObject>(filePath: string): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf8");
    return raw.trim() ? (JSON.parse(raw) as T) : ({} as T);
  } catch (err) {
    if (isNodeError(err) && err.code === "ENOENT") {
      return {} as T;
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to read ${filePath}: ${message}`);
  }
}

export async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  const tmpPath = `${filePath}.tmp-${process.pid}`;
  await writeFile(tmpPath, serialized, { mode: 0o600 });
  await rename(tmpPath, filePath);
}

/**
 * Key resolution order, documented in docs/cli-design.md: explicit flag >
 * harness-local stored key > global config > TOGETHER_API_KEY env var.
 */
type ResolveTogetherApiKeyOptions = {
  apiKey?: string | undefined;
  home?: string | undefined;
  resolveKey?: () => Promise<string>;
};

export async function resolveTogetherApiKey({ apiKey, resolveKey, home }: ResolveTogetherApiKeyOptions): Promise<string> {
  if (apiKey?.trim()) {
    return apiKey.trim();
  }
  const harnessKey = await resolveKey?.();
  if (harnessKey) {
    return harnessKey;
  }
  if (home) {
    const { readGlobalConfig, resolveStoredApiKey } = await import("./global-config.js");
    const globalKey = resolveStoredApiKey((await readGlobalConfig(home)).apiKey);
    if (globalKey) {
      return globalKey;
    }
  }
  return process.env.TOGETHER_API_KEY?.trim() ?? "";
}

export function detectApiKeyType(key: string | undefined): "together" | "unknown" {
  if (!key) {
    return "unknown";
  }
  // Together keys are flat opaque strings with no documented prefix
  // convention (unlike Fireworks's fw_/fpk_ split), so there's nothing to
  // branch on yet — kept as a named function so harness code reads the
  // same way fireconnect's does, and so a future prefix convention (if
  // Together introduces one) only needs to change here.
  return "together";
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}
