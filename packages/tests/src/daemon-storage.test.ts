import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";

const cleanup: string[] = [];

afterEach(() => {
  for (const directory of cleanup.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("daemon session persistence", () => {
  test("restores the session-scoped Together base URL", async () => {
    const home = mkdtempSync(join(tmpdir(), "togetherlink-daemon-store-"));
    cleanup.push(home);
    const output = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
          import { createSessionStore } from "./packages/cli/dist/lib/daemon/storage.js";
          import { GLM_5_2 } from "./packages/models/dist/index.js";
          const home = process.argv[1];
          const store = await createSessionStore(home);
          if (store.kind !== "sqlite") throw new Error("sqlite unavailable");
          store.upsertSession({
            token: "session-with-base-url",
            agent: "claude",
            apiKey: "phantom-key",
            baseUrl: "http://protected-proxy.test/together/v1",
            nativeBaseUrl: "https://chatgpt.example/backend-api/codex",
            modelLabel: GLM_5_2.name,
            modelId: GLM_5_2.anthropicAlias ?? GLM_5_2.id,
            targetModelId: GLM_5_2.id,
            modelName: GLM_5_2.name,
            modelDefinition: GLM_5_2,
            startedAt: 1,
            lastSeenAt: 2,
            costSummary: "test",
            costTotals: { promptTokens: 0, cachedTokens: 0, completionTokens: 0, costUsd: 0 },
          });
          store.close();
          const restoredStore = await createSessionStore(home);
          const restored = restoredStore.restoreActiveSessions();
          restoredStore.close();
          process.stdout.write(JSON.stringify({
            baseUrl: restored[0]?.baseUrl,
            nativeBaseUrl: restored[0]?.nativeBaseUrl,
          }));
        `,
        home,
      ],
      { cwd: join(process.cwd(), "..", ".."), encoding: "utf8" },
    );

    expect(JSON.parse(output)).toEqual({
      baseUrl: "http://protected-proxy.test/together/v1",
      nativeBaseUrl: "https://chatgpt.example/backend-api/codex",
    });
  });

  test("queries ended proxied sessions with durable per-model usage", async () => {
    const home = mkdtempSync(join(tmpdir(), "togetherlink-daemon-usage-"));
    cleanup.push(home);
    const output = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
          import { createSessionStore } from "./packages/cli/dist/lib/daemon/storage.js";
          import { GLM_5_2 } from "./packages/models/dist/index.js";
          const home = process.argv[1];
          const store = await createSessionStore(home);
          if (store.kind !== "sqlite") throw new Error("sqlite unavailable");
          const base = {
            apiKey: "phantom-key",
            modelLabel: GLM_5_2.name,
            targetModelId: GLM_5_2.id,
            modelDefinition: GLM_5_2,
            startedAt: 100,
            lastSeenAt: 200,
            endedAt: 300,
            costSummary: "test",
            costTotals: { promptTokens: 10, cachedTokens: 2, completionTokens: 3, costUsd: 1.25 },
            usageByModel: [{ model: GLM_5_2.id, promptTokens: 10, cachedTokens: 2, completionTokens: 3, costUsd: 1.25 }],
          };
          store.upsertSession({ ...base, token: "claude", agent: "claude" });
          store.upsertSession({ ...base, token: "direct", agent: "opencode" });
          store.upsertSession({ ...base, token: "too-old", agent: "codex", endedAt: 99 });
          process.stdout.write(JSON.stringify(store.queryUsageSince(100)));
          store.close();
        `,
        home,
      ],
      { cwd: join(process.cwd(), "..", ".."), encoding: "utf8" },
    );

    expect(JSON.parse(output)).toEqual([
      {
        agent: "claude",
        costUsd: 1.25,
        usageByModel: [
          {
            model: "zai-org/GLM-5.2",
            promptTokens: 10,
            cachedTokens: 2,
            completionTokens: 3,
            costUsd: 1.25,
          },
        ],
      },
    ]);
  });
});
