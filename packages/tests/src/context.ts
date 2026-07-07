import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { artifactsDir, cliBin, repoRoot, tmpDir } from "./paths.js";
import type { TestContext } from "./types.js";

export async function createTestContext(): Promise<TestContext> {
  await mkdir(artifactsDir, { recursive: true });
  await mkdir(tmpDir, { recursive: true });
  const suiteTmpDir = await mkdtemp(path.join(tmpDir, "suite-"));
  const togetherlinkHome = path.join(suiteTmpDir, "togetherlink-home");
  await mkdir(togetherlinkHome, { recursive: true });
  return {
    repoRoot,
    cliBin,
    artifactsDir,
    tmpDir: suiteTmpDir,
    togetherlinkHome,
    daemonPort: await findOpenPort(),
    results: [],
  };
}

export async function resetTmpDir(context: TestContext): Promise<void> {
  await stopContextDaemon(context);
  await rm(context.tmpDir, { recursive: true, force: true });
  await mkdir(context.tmpDir, { recursive: true });
  if (context.togetherlinkHome) {
    await mkdir(context.togetherlinkHome, { recursive: true });
  }
}

export async function cleanupTmpDir(context: TestContext): Promise<void> {
  await stopContextDaemon(context);
  await rm(context.tmpDir, { recursive: true, force: true });
}

async function findOpenPort(): Promise<number> {
  const server = http.createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("could not allocate test daemon port");
  }
  const port = address.port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

async function stopContextDaemon(context: TestContext): Promise<void> {
  if (!context.togetherlinkHome) {
    return;
  }
  const raw = await readFile(path.join(context.togetherlinkHome, "daemon.pid"), "utf8").catch(
    () => undefined,
  );
  const pid = raw ? Number.parseInt(raw.trim(), 10) : NaN;
  if (!Number.isFinite(pid) || pid <= 0) {
    return;
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ESRCH") {
      throw err;
    }
    return;
  }

  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0);
      await sleep(50);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ESRCH") {
        return;
      }
      throw err;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
