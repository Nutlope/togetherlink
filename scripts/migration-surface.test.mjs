import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);

test("builds the legacy updater manifest that hands v0.8.8 users to the migration bridge", async () => {
  const output = await mkdtemp(path.join(tmpdir(), "togetherlink-migration-surface-"));
  try {
    await execFileAsync(process.execPath, ["scripts/build-migration-surface.mjs", output]);
    const manifest = JSON.parse(await readFile(path.join(output, "latest.json"), "utf8"));
    assert.deepEqual(manifest, {
      version: "0.9.0",
      url: "https://gateway.togetherlink.dev/legacy-migrate.js",
      channel: "migration",
    });
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
