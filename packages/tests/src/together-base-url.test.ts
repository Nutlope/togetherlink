import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { GLM_5_2 } from "@togetherlink/models";
import { buildGrokModelCatalog } from "../../cli/src/lib/grok/core.js";
import { loadEnvFile } from "../../cli/src/lib/load-env.js";
import { buildOpencodeConfigJson } from "../../cli/src/lib/opencode/core.js";
import { buildPiModelsJson } from "../../cli/src/lib/harnesses/pi.js";
import { resolveTogetherBaseUrl } from "../../cli/src/lib/together-core.js";

const cleanup: string[] = [];

afterEach(() => {
  vi.unstubAllEnvs();
  for (const directory of cleanup.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("Together upstream base URL", () => {
  test("keeps the public Together v1 API as the default", () => {
    expect(resolveTogetherBaseUrl({})).toBe("https://api.together.ai/v1");
  });

  test.each([
    ["http://127.0.0.1:1234/together", "http://127.0.0.1:1234/together/v1"],
    ["http://127.0.0.1:1234/together/v1", "http://127.0.0.1:1234/together/v1"],
    ["http://127.0.0.1:1234/together/", "http://127.0.0.1:1234/together/v1"],
    ["http://127.0.0.1:1234/together/v1///", "http://127.0.0.1:1234/together/v1"],
  ])("normalizes %s", (value, expected) => {
    expect(resolveTogetherBaseUrl({ TOGETHER_BASE_URL: value })).toBe(expected);
  });

  test("does not load TOGETHER_BASE_URL from a repository .env file", () => {
    const directory = mkdtempSync(join(tmpdir(), "togetherlink-env-"));
    cleanup.push(directory);
    writeFileSync(
      join(directory, ".env"),
      "TOGETHER_API_KEY=from-file\nTOGETHER_BASE_URL=http://untrusted.invalid\n",
      "utf8",
    );
    vi.stubEnv("TOGETHER_API_KEY", "");
    vi.stubEnv("TOGETHER_BASE_URL", "");
    delete process.env.TOGETHER_API_KEY;
    delete process.env.TOGETHER_BASE_URL;

    loadEnvFile(directory);

    expect(process.env.TOGETHER_API_KEY).toBe("from-file");
    expect(process.env.TOGETHER_BASE_URL).toBeUndefined();
  });
});

describe("direct coding harness configuration", () => {
  const baseUrl = "http://127.0.0.1:1234/together/v1";

  test("OpenCode receives options.baseURL", () => {
    const config = buildOpencodeConfigJson({ baseUrl });
    expect(config.provider?.togetherai?.options).toEqual({
      apiKey: "{env:TOGETHER_API_KEY}",
      baseURL: baseUrl,
    });
  });

  test("Grok catalog receives base_url", () => {
    expect(buildGrokModelCatalog(baseUrl).data[0]?.base_url).toBe(baseUrl);
  });

  test("Pi receives baseUrl", () => {
    const config = JSON.parse(buildPiModelsJson("phantom-key", baseUrl)) as {
      providers: { together: { apiKey: string; baseUrl: string } };
    };
    expect(config.providers.together).toMatchObject({
      apiKey: "phantom-key",
      baseUrl,
    });
  });
});
