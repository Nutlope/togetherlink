import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { artifactsDir, cliBin, repoRoot, tmpDir } from "./paths.js";
import type { TestContext } from "./types.js";

export async function createTestContext(): Promise<TestContext> {
  await mkdir(artifactsDir, { recursive: true });
  await mkdir(tmpDir, { recursive: true });
  const suiteTmpDir = await mkdtemp(path.join(tmpDir, "suite-"));
  return {
    repoRoot,
    cliBin,
    artifactsDir,
    tmpDir: suiteTmpDir,
    results: [],
  };
}

export async function resetTmpDir(context: TestContext): Promise<void> {
  await rm(context.tmpDir, { recursive: true, force: true });
  await mkdir(context.tmpDir, { recursive: true });
}

export async function cleanupTmpDir(context: TestContext): Promise<void> {
  await rm(context.tmpDir, { recursive: true, force: true });
}
