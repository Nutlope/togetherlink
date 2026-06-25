import { mkdir, rm } from "node:fs/promises";
import { artifactsDir, cliBin, repoRoot, tmpDir } from "./paths.js";
import type { TestContext } from "./types.js";

export async function createTestContext(): Promise<TestContext> {
  await mkdir(artifactsDir, { recursive: true });
  await mkdir(tmpDir, { recursive: true });
  return {
    repoRoot,
    cliBin,
    artifactsDir,
    tmpDir,
    results: [],
  };
}

export async function resetTmpDir(context: TestContext): Promise<void> {
  await rm(context.tmpDir, { recursive: true, force: true });
  await mkdir(context.tmpDir, { recursive: true });
}
