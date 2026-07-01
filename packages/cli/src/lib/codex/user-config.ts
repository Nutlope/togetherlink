import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const FIRST_RUN_CODEX_DEFAULTS = {
  approval_policy: "on-request",
  sandbox_mode: "workspace-write",
  approvals_reviewer: "auto_review",
} as const;

export async function ensureCodexGenericUserDefaults(home: string): Promise<void> {
  const configPath = codexConfigPath(home);
  const existing = await readTextIfExists(configPath);
  const next = applyCodexGenericUserDefaults(existing ?? "");
  if (next === (existing ?? "")) {
    return;
  }
  await writeTextAtomic(configPath, next);
}

export function applyCodexGenericUserDefaults(rawConfig: string): string {
  if (rawConfig.trim() !== "") {
    return rawConfig;
  }

  return `${Object.entries(FIRST_RUN_CODEX_DEFAULTS)
    .map(([key, value]) => `${key} = ${tomlString(value)}`)
    .join("\n")}\n`;
}

export function codexArgsIgnoreUserConfig(args: string[]): boolean {
  return args.includes("--ignore-user-config");
}

function codexConfigPath(home: string): string {
  return path.join(home, ".codex", "config.toml");
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

function tomlString(value: string): string {
  return JSON.stringify(value);
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}
