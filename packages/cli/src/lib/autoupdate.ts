/**
 * Self-update. The installed CLI lives as a single Bun-target JS bundle at
 * `<home>/.togetherlink/bin/togetherlink.js`, launched by a tiny `togetherlink`
 * shell wrapper that calls `bun run` on it. To update, we fetch a small
 * `latest.json` manifest from the project site, compare versions, and if newer
 * download the new bundle and atomically rename it over the installed file.
 * Each startup also fills in wrapper commands added since the original install.
 *
 * The running process keeps the old inode, so the *next* invocation is the new
 * version — we never hot-swap mid-execution. Every failure path is swallowed:
 * an update problem must never block or crash the user's actual command.
 */

import { constants } from "node:fs";
import { access, mkdir, writeFile, rename, stat, symlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { VERSION } from "./version.js";

/** Single origin for the landing page, manifest, and downloadable bundle. */
const UPDATE_ORIGIN = "https://togetherlink.vercel.app";
/** Override for testing/local mirrors; normally unset. */
function resolveManifestUrl(): string {
  return process.env.TOGETHERLINK_MANIFEST_URL ?? `${UPDATE_ORIGIN}/latest.json`;
}

const THROTTLE_MS = 60 * 60 * 1000; // re-check at most once per hour
const OVERALL_TIMEOUT_MS = 10_000;
const FETCH_TIMEOUT_MS = 5_000;

type Manifest = { version: string; url?: string };

/**
 * Where the install lives. `TOGETHERLINK_HOME` (when set) is the `.togetherlink`
 * directory itself — matching `scripts/install.sh`, which installs the bundle
 * at `$TOGETHERLINK_HOME/bin/togetherlink.js`. When unset, default to
 * `~/.togetherlink`.
 */
function resolveInstallDir(): string {
  return process.env.TOGETHERLINK_HOME || path.join(os.homedir(), ".togetherlink");
}

/** Installed bundle path. `togetherlink` wrapper runs `bun run` on this. */
function installedBundlePath(): string {
  return path.join(resolveInstallDir(), "bin", "togetherlink.js");
}

const INSTALLED_WRAPPERS = [
  ["togetherlink", undefined],
  ["tclaude", "claude"],
  ["topencode", "opencode"],
  ["tcodex", "codex"],
  ["tdeepseek", "deepseek"],
  ["tdroid", "droid"],
  ["tgrok", "grok"],
  ["thermes", "hermes"],
  ["tpi", "pi"],
  ["tprime", "prime"],
] as const;

function quoteForSh(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

/**
 * Add wrapper commands introduced after a user's original installation. Never
 * replace an existing launcher: it may be a deliberate local override.
 */
async function findWritablePathDir(
  binDir: string,
  env: NodeJS.ProcessEnv,
): Promise<string | undefined> {
  if (process.platform === "win32") {
    return undefined;
  }
  for (const candidate of (env.PATH ?? "").split(path.delimiter)) {
    if (!candidate || path.resolve(candidate) === path.resolve(binDir)) {
      continue;
    }
    try {
      if (!(await stat(candidate)).isDirectory()) {
        continue;
      }
      await access(candidate, constants.W_OK);
      return candidate;
    } catch {
      // Keep looking for the next writable PATH directory.
    }
  }
  return undefined;
}

export async function ensureInstalledWrappers(
  installDir = resolveInstallDir(),
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const binDir = path.join(installDir, "bin");
  const bundle = quoteForSh(path.join(binDir, "togetherlink.js"));
  await mkdir(binDir, { recursive: true });

  await Promise.all(
    INSTALLED_WRAPPERS.map(async ([name, harness]) => {
      const harnessArg = harness ? ` ${harness}` : "";
      const contents = `#!/usr/bin/env sh\nexec bun ${bundle}${harnessArg} "$@"\n`;
      try {
        await writeFile(path.join(binDir, name), contents, { flag: "wx", mode: 0o755 });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
          throw error;
        }
      }
    }),
  );

  const linkDir = await findWritablePathDir(binDir, env);
  if (!linkDir) {
    return;
  }
  await Promise.all(
    INSTALLED_WRAPPERS.map(async ([name]) => {
      try {
        await symlink(path.join(binDir, name), path.join(linkDir, name));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
          throw error;
        }
      }
    }),
  );
}

/**
 * Is the currently-running script the installed bundle? We only self-update the
 * installed copy — a dev run from the repo (`tsc`/source) is left alone.
 */
function isInstalledBundle(): boolean {
  const argv1 = process.argv[1];
  if (!argv1) {
    return false;
  }
  try {
    const resolved = path.resolve(argv1);
    const installed = installedBundlePath();
    // realpath handles macOS /tmp → /private/tmp symlinks, so the comparison
    // matches even when the install dir was reached through a symlinked prefix.
    return realpathSafe(resolved) === realpathSafe(installed);
  } catch {
    return false;
  }
}

function realpathSafe(p: string): string {
  try {
    return require("node:fs").realpathSync(p) as string;
  } catch {
    return p;
  }
}

function throttleFile(): string {
  return path.join(resolveInstallDir(), ".update-check");
}

async function throttled(): Promise<boolean> {
  try {
    const s = await stat(throttleFile());
    return Date.now() - s.mtimeMs < THROTTLE_MS;
  } catch {
    return false;
  }
}

async function touchThrottle(): Promise<void> {
  try {
    await writeFile(throttleFile(), "", { flag: "w" });
  } catch {
    // Non-fatal: worst case we re-check next run.
  }
}

function parseSemver(v: string): [number, number, number] | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v.trim());
  if (!m) {
    return null;
  }
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function isNewer(latest: string, current: string): boolean {
  const a = parseSemver(latest);
  const b = parseSemver(current);
  if (!a || !b) {
    return false;
  }
  for (let i = 0; i < 3; i += 1) {
    const av = a[i];
    const bv = b[i];
    if (av !== bv && av !== undefined && bv !== undefined) {
      return av > bv;
    }
  }
  return false;
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  try {
    return await Promise.race([p, guard]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

async function fetchManifest(): Promise<Manifest> {
  const res = await withTimeout(
    fetch(resolveManifestUrl(), {
      headers: { "User-Agent": `togetherlink/${VERSION}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    }),
    FETCH_TIMEOUT_MS,
  );
  if (!res.ok) {
    throw new Error(`manifest ${res.status}`);
  }
  const data = (await res.json()) as Manifest;
  if (!data?.version) {
    throw new Error("manifest missing version");
  }
  return data;
}

async function downloadTo(url: string, dest: string): Promise<void> {
  const res = await withTimeout(
    fetch(url, {
      headers: { "User-Agent": `togetherlink/${VERSION}` },
      signal: AbortSignal.timeout(OVERALL_TIMEOUT_MS),
    }),
    OVERALL_TIMEOUT_MS,
  );
  if (!res.ok || !res.body) {
    throw new Error(`download ${res.status}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength === 0) {
    throw new Error("empty download");
  }
  const tmp = `${dest}.new-${process.pid}`;
  await writeFile(tmp, buf, { mode: 0o644 });
  await rename(tmp, dest);
}

/**
 * Check for and apply a self-update. Safe to `await` at startup: throttled to
 * once/hour, bounded by a 10s overall timeout, and never throws. No-op unless
 * the running script is the installed bundle.
 */
export async function maybeSelfUpdate(): Promise<void> {
  if (!isInstalledBundle()) {
    return; // dev/source run — don't touch it
  }
  try {
    await ensureInstalledWrappers();
  } catch {
    // Non-fatal: wrapper repair must never block the requested command.
  }
  if (await throttled()) {
    return;
  }
  await touchThrottle();

  try {
    const manifest = await withTimeout(fetchManifest(), OVERALL_TIMEOUT_MS);
    if (!isNewer(manifest.version, VERSION)) {
      return;
    }
    const dest = installedBundlePath();
    const url = manifest.url ?? `${UPDATE_ORIGIN}/togetherlink.js`;
    await downloadTo(url, dest);
    process.stderr.write(`togetherlink: updated to v${manifest.version} (next run uses it)\n`);
  } catch {
    // Swallowed: update failure never breaks the user's command.
  }
}
