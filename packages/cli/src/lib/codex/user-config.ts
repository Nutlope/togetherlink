import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_APPROVAL_POLICY = "untrusted";

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

  const [preamble, rest] = splitTomlPreamble(rawConfig);
  if (hasTopLevelTomlKey(preamble, "approval_policy")) {
    return rawConfig;
  }

  const compact = preamble.trimEnd();
  const prefix = compact ? `${compact}\n` : "";
  return `${prefix}approval_policy = ${tomlString(DEFAULT_APPROVAL_POLICY)}\n${rest}`;
}

export function codexArgsIgnoreUserConfig(args: string[]): boolean {
  return args.includes("--ignore-user-config");
}

function codexConfigPath(home: string): string {
  return path.join(home, ".codex", "config.toml");
}

function splitTomlPreamble(raw: string): [string, string] {
  const match = raw.match(/(?:^|\n)\s*\[/);
  if (!match || match.index === undefined) {
    return [raw, ""];
  }
  const tableStart = match[0].startsWith("\n") ? match.index + 1 : match.index;
  return [raw.slice(0, tableStart), raw.slice(tableStart)];
}

function hasTopLevelTomlKey(preamble: string, key: string): boolean {
  return preamble.split(/\n/).some((line) => {
    const match = /^(\s*)([A-Za-z0-9_-]+)(\s*=\s*)(.*)$/.exec(line);
    return match?.[2] === key;
  });
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
