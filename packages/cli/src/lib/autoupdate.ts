/**
 * Self-update. The installed CLI lives as a single Bun-target JS bundle at
 * `<home>/.togetherlink/bin/togetherlink.js`, launched by a tiny `togetherlink`
 * shell wrapper that calls `bun run` on it. To update, we fetch a small
 * `latest.json` manifest from the project site, compare versions, and if newer
 * download the new bundle and atomically rename it over the installed file.
 *
 * The running process keeps the old inode, so the *next* invocation is the new
 * version — we never hot-swap mid-execution. Every failure path is swallowed:
 * an update problem must never block or crash the user's actual command.
 */

import { readFile, writeFile, rename, stat } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { VERSION } from "./version.js";

/** Single origin for the landing page, manifest, and downloadable bundle. */
export const UPDATE_ORIGIN = "https://togetherlink.dev";
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
export function installedBundlePath(): string {
  return path.join(resolveInstallDir(), "bin", "togetherlink.js");
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
  if (process.env.TOGETHERLINK_NO_AUTOPDATE === "1") {
    return;
  }
  if (process.argv.includes("--no-update")) {
    return;
  }
  if (!isInstalledBundle()) {
    return; // dev/source run — don't touch it
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