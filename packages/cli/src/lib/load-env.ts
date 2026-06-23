import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const LOADABLE_ENV_KEYS = new Set(["TOGETHER_API_KEY"]);

/**
 * Loads a .env file into process.env, without pulling in a dotenv dependency.
 * Only sets values for keys that are not already present in the environment —
 * real exports / shell-defined vars always win, matching dotenv's `override: false`.
 * Only the Together key is loaded from project .env files. EXA_API_KEY is not
 * loaded here because web-search queries would be visible to whoever owns that
 * key; use the real environment or `togetherlink configure` for Exa.
 *
 * Looks first in the directory the CLI was invoked from (cwd), then walks up
 * to the repo root so `togetherlink claude` run from a workspace picks up the
 * shared root .env.
 */
export function loadEnvFile(startDir = process.cwd()): void {
  const file = findEnvFile(startDir);
  if (!file) {
    return;
  }
  const raw = readFileSync(file, "utf8");
  for (const entry of parseEnv(raw)) {
    if (!LOADABLE_ENV_KEYS.has(entry.key)) {
      continue;
    }
    if (process.env[entry.key] === undefined) {
      process.env[entry.key] = entry.value;
    }
  }
}

function findEnvFile(startDir: string): string | null {
  let dir = path.resolve(startDir);
  // Guard against infinite loops at the filesystem root.
  for (let i = 0; i < 20; i += 1) {
    const candidate = path.join(dir, ".env");
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return null;
}

type EnvEntry = { key: string; value: string };

/**
 * Minimal .env parser: KEY=value per line, supports surrounding quotes,
 * `#` comments, and blank lines. Lines exporting `export KEY=...` are tolerated.
 * Does not interpolate ${VAR} references — values are taken literally.
 */
function parseEnv(raw: string): EnvEntry[] {
  const entries: EnvEntry[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const withoutExport = trimmed.startsWith("export ") ? trimmed.slice("export ".length) : trimmed;
    const eq = withoutExport.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = withoutExport.slice(0, eq).trim();
    if (!key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }
    let value = withoutExport.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Strip a trailing inline comment for unquoted values, e.g. KEY=value # note.
    else if (value.includes(" #")) {
      value = (value.split(" #")[0] ?? value).trim();
    }
    entries.push({ key, value });
  }
  return entries;
}
