import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { persistPiManagedTools, seedPiManagedTools } from "../../cli/src/lib/harnesses/pi.js";

const cleanup: string[] = [];

function makeDir(prefix: string): string {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  cleanup.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of cleanup.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("Pi managed tools (fd/rg) reuse", () => {
  test("seeds the temp agent dir with fd from the user's ~/.pi/agent/bin", () => {
    const agentDir = makeDir("togetherlink-pi-agent-");
    const userBinDir = join(makeDir("togetherlink-pi-user-"), "bin");
    mkdirSync(userBinDir, { recursive: true });
    writeFileSync(join(userBinDir, "fd"), "fake-fd-binary");

    seedPiManagedTools(agentDir, userBinDir);

    expect(readFileSync(join(agentDir, "bin", "fd"), "utf8")).toBe("fake-fd-binary");
  });

  test("does nothing when the user has no managed bin dir yet", () => {
    const agentDir = makeDir("togetherlink-pi-agent-");
    const userBinDir = join(makeDir("togetherlink-pi-user-"), "bin");

    seedPiManagedTools(agentDir, userBinDir);

    expect(existsSync(join(agentDir, "bin"))).toBe(false);
  });

  test("persists tools Pi downloaded during the session back to the user bin dir", () => {
    const agentDir = makeDir("togetherlink-pi-agent-");
    const userBinDir = join(makeDir("togetherlink-pi-user-"), "bin");
    mkdirSync(join(agentDir, "bin"), { recursive: true });
    writeFileSync(join(agentDir, "bin", "fd"), "downloaded-fd");

    persistPiManagedTools(agentDir, userBinDir);

    expect(readFileSync(join(userBinDir, "fd"), "utf8")).toBe("downloaded-fd");
  });

  test("never overwrites an existing managed tool in the user bin dir", () => {
    const agentDir = makeDir("togetherlink-pi-agent-");
    const userBinDir = join(makeDir("togetherlink-pi-user-"), "bin");
    mkdirSync(join(agentDir, "bin"), { recursive: true });
    mkdirSync(userBinDir, { recursive: true });
    writeFileSync(join(agentDir, "bin", "fd"), "new-download");
    writeFileSync(join(userBinDir, "fd"), "original");

    persistPiManagedTools(agentDir, userBinDir);

    expect(readFileSync(join(userBinDir, "fd"), "utf8")).toBe("original");
  });

  test("ignores non-managed files in the temp bin dir", () => {
    const agentDir = makeDir("togetherlink-pi-agent-");
    const userBinDir = join(makeDir("togetherlink-pi-user-"), "bin");
    mkdirSync(join(agentDir, "bin"), { recursive: true });
    writeFileSync(join(agentDir, "bin", "fd-v10.4.2-aarch64-apple-darwin.tar.gz"), "archive");

    persistPiManagedTools(agentDir, userBinDir);

    expect(existsSync(join(userBinDir, "fd-v10.4.2-aarch64-apple-darwin.tar.gz"))).toBe(false);
  });

  test("keeps the seeded binary executable", () => {
    const agentDir = makeDir("togetherlink-pi-agent-");
    const userBinDir = join(makeDir("togetherlink-pi-user-"), "bin");
    mkdirSync(userBinDir, { recursive: true });
    const source = join(userBinDir, "fd");
    writeFileSync(source, "fake-fd-binary");
    chmodSync(source, 0o755);

    seedPiManagedTools(agentDir, userBinDir);

    const seededMode = statSync(join(agentDir, "bin", "fd")).mode & 0o777;
    expect(seededMode & 0o111).not.toBe(0);
  });
});
