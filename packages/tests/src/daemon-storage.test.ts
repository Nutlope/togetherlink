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
          process.stdout.write(restored[0]?.baseUrl ?? "missing");
        `,
        home,
      ],
      { cwd: join(process.cwd(), "..", ".."), encoding: "utf8" },
    );

    expect(output).toBe("http://protected-proxy.test/together/v1");
  });
});
