import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { TestContext } from "./types.js";
import { assert } from "./assert.js";

const GLM_5_2 = {
  id: "zai-org/GLM-5.2",
  name: "GLM 5.2 · default",
  anthropicAlias: "together-glm-5-2",
  cost: { input: 1.4, output: 4.4, cache_read: 0.26 },
  limit: { context: 262144, output: 164000 },
  attachment: false,
  reasoning: true,
  temperature: true,
  tool_call: true,
  modalities: { input: ["text"], output: ["text"] },
};

export type TestDaemon = {
  url: string;
  stderr: () => string;
  stop: () => Promise<void>;
};

export async function startTestDaemon(context: TestContext): Promise<TestDaemon> {
  const port = await findOpenPort();
  const home = await mkdtemp(path.join(context.tmpDir, "daemon-home-"));
  let stderr = "";
  const child = spawn(process.execPath, [context.cliBin, "--daemon"], {
    cwd: context.repoRoot,
    env: {
      ...process.env,
      TOGETHERLINK_DEBUG: "1",
      TOGETHERLINK_HOME: home,
      TOGETHERLINK_PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });
  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`daemon exited early: ${stderr}`);
    }
    try {
      const response = await fetch(`${url}/healthz`);
      if (response.ok) {
        return {
          url,
          stderr: () => stderr,
          stop: async () => {
            child.kill("SIGTERM");
            await new Promise((resolve) => child.once("exit", resolve));
            await rm(home, { recursive: true, force: true });
          },
        };
      }
    } catch {
      await sleep(100);
    }
  }
  child.kill("SIGTERM");
  await rm(home, { recursive: true, force: true });
  throw new Error(`daemon did not become healthy: ${stderr}`);
}

export async function registerClaudeSession(context: TestContext, daemon: TestDaemon): Promise<string> {
  return await registerSession(context, daemon, "claude");
}

export async function registerCodexSession(context: TestContext, daemon: TestDaemon): Promise<string> {
  return await registerSession(context, daemon, "codex");
}

async function registerSession(context: TestContext, daemon: TestDaemon, agent: "claude" | "codex"): Promise<string> {
  const apiKey = await resolveTogetherApiKey(context.repoRoot);
  const token = `${agent}-context-test-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const response = await fetch(`${daemon.url}/internal/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token,
      agent,
      apiKey,
      modelLabel: GLM_5_2.name,
      modelId: agent === "claude" ? GLM_5_2.anthropicAlias : GLM_5_2.id,
      targetModelId: GLM_5_2.id,
      modelName: GLM_5_2.name,
      modelDefinition: GLM_5_2,
      debug: true,
    }),
  });
  assert(response.ok, `session registration failed: ${response.status} ${await response.text()}`);
  return token;
}

export async function deleteSession(daemon: TestDaemon, token: string): Promise<void> {
  await fetch(`${daemon.url}/internal/sessions/${encodeURIComponent(token)}`, { method: "DELETE" }).catch(() => {});
}

async function resolveTogetherApiKey(repoRoot: string): Promise<string> {
  const envKey = process.env.TOGETHER_API_KEY?.trim();
  if (envKey) {
    return envKey;
  }
  const envFile = await readFile(path.join(repoRoot, ".env"), "utf8").catch(() => "");
  const line = envFile.split(/\r?\n/).find((entry) => entry.startsWith("TOGETHER_API_KEY="));
  const key = line?.slice("TOGETHER_API_KEY=".length).trim() ?? "";
  assert(key.length > 0, "TOGETHER_API_KEY is not set and was not found in .env");
  return key;
}

async function findOpenPort(): Promise<number> {
  const server = http.createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(typeof address === "object" && address !== null, "could not allocate test port");
  const port = address.port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
