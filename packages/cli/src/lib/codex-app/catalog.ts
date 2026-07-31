import { execFile } from "node:child_process";
import { readFile, rename, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { findModelById } from "@togetherlink/models";
import { mergeCodexModelCatalog, type CodexModelCatalog } from "../codex/catalog.js";

const execFileAsync = promisify(execFile);

export function mergedCodexAppCatalogJson(nativeCatalog: CodexModelCatalog): string {
  return JSON.stringify(mergeCodexModelCatalog(nativeCatalog));
}

/**
 * Capture native metadata before the app starts using TogetherLink's merged
 * catalog. Prefer Codex's authenticated catalog so account rollouts are
 * preserved; known Together rows are filtered if this is a re-run. The
 * bundled catalog, app cache, and our prior snapshot are progressively safer
 * fallbacks.
 */
export async function writeMergedCodexAppCatalog(
  home: string,
  outputPath: string,
  nativeSnapshotPath: string,
): Promise<number> {
  const nativeCatalog = await loadNativeCatalog(home, nativeSnapshotPath);
  await writeTextAtomic(nativeSnapshotPath, `${JSON.stringify(nativeCatalog, null, 2)}\n`);
  const merged = mergeCodexModelCatalog(nativeCatalog);
  await writeTextAtomic(outputPath, `${JSON.stringify(merged)}\n`);
  return merged.models.length;
}

async function loadNativeCatalog(
  home: string,
  nativeSnapshotPath: string,
): Promise<CodexModelCatalog> {
  const authenticated = await commandNativeCatalog(home, []);
  if (authenticated && hasLikelyNativeModels(authenticated)) return authenticated;

  const bundled = await bundledNativeCatalog(home);
  if (bundled) return bundled;

  const cached = nativeOnly(await readCatalog(path.join(home, ".codex", "models_cache.json")));
  if (cached && hasLikelyNativeModels(cached)) return cached;

  const snapshot = await readCatalog(nativeSnapshotPath);
  if (snapshot && hasLikelyNativeModels(snapshot)) return snapshot;

  throw new Error(
    "Could not read the native Codex model catalog. Open ChatGPT Desktop once while signed in, or install/update the Codex CLI, then rerun `togetherlink chatgpt`.",
  );
}

async function bundledNativeCatalog(home: string): Promise<CodexModelCatalog | undefined> {
  return commandNativeCatalog(home, ["--bundled"]);
}

async function commandNativeCatalog(
  home: string,
  extraArgs: string[],
): Promise<CodexModelCatalog | undefined> {
  try {
    const { stdout } = await execFileAsync("codex", ["debug", "models", ...extraArgs], {
      encoding: "utf8",
      timeout: 30_000,
      maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env, CODEX_HOME: path.join(home, ".codex") },
    });
    return nativeOnly(parseCatalog(stdout));
  } catch {
    return undefined;
  }
}

function nativeOnly(catalog: CodexModelCatalog | undefined): CodexModelCatalog | undefined {
  if (!catalog) return undefined;
  const models = catalog.models.filter((entry) => !findModelById(String(entry.slug)));
  return models.length > 0 ? { models } : undefined;
}

async function readCatalog(file: string): Promise<CodexModelCatalog | undefined> {
  try {
    return parseCatalog(await readFile(file, "utf8"));
  } catch {
    return undefined;
  }
}

function parseCatalog(raw: string): CodexModelCatalog | undefined {
  try {
    const parsed = JSON.parse(raw) as { models?: unknown[] };
    if (!Array.isArray(parsed.models) || parsed.models.length === 0) return undefined;
    const models = parsed.models.filter(
      (entry): entry is Record<string, unknown> =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as { slug?: unknown }).slug === "string",
    );
    return models.length > 0 ? { models } : undefined;
  } catch {
    return undefined;
  }
}

function hasLikelyNativeModels(catalog: CodexModelCatalog): boolean {
  return catalog.models.some((entry) => /^gpt-|^o\d/.test(String(entry.slug)));
}

async function writeTextAtomic(file: string, value: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  await writeFile(temporary, value, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, file);
}
