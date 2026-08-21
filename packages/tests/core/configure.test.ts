import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

import { runConfigure } from "../../cli/src/lib/commands/global.js";
import { readGlobalConfig, resolveStoredExaApiKey } from "../../cli/src/lib/global-config.js";

const temporaryHomes: string[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    temporaryHomes.splice(0).map((home) => rm(home, { recursive: true, force: true })),
  );
});

describe("togetherlink configure", () => {
  test("persists an Exa key across a cold start even when configure reads it from the environment", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "togetherlink-configure-"));
    temporaryHomes.push(home);
    vi.stubEnv("TOGETHER_API_KEY", "together-test-key");
    vi.stubEnv("EXA_API_KEY", "exa-test-key");

    await runConfigure(home);

    vi.stubEnv("EXA_API_KEY", "");
    const stored = (await readGlobalConfig(home)).exaApiKey;

    expect(stored).toBe("exa-test-key");
    expect(resolveStoredExaApiKey(stored)).toBe("exa-test-key");
  });
});
