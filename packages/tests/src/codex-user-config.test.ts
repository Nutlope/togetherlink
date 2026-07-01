import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  applyCodexGenericUserDefaults,
  codexArgsIgnoreUserConfig,
  ensureCodexGenericUserDefaults,
} from "../../cli/src/lib/codex/user-config.js";

describe("Codex generic user config", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "togetherlink-codex-user-config-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("adds the cautious approval default for empty config", () => {
    expect(applyCodexGenericUserDefaults("")).toBe('approval_policy = "untrusted"\n');
  });

  test("leaves existing config without approval policy untouched", () => {
    const raw = ['model = "gpt-5.5"', "", '[projects."/repo"]', 'trust_level = "trusted"', ""].join(
      "\n",
    );

    expect(applyCodexGenericUserDefaults(raw)).toBe(raw);
  });

  test("preserves an explicit approval preference", () => {
    const raw = ['approval_policy = "never"', "", '[projects."/repo"]', ""].join("\n");

    expect(applyCodexGenericUserDefaults(raw)).toBe(raw);
  });

  test("seeds only generic Codex preferences on disk", async () => {
    await ensureCodexGenericUserDefaults(tmpDir);

    const config = await readFile(path.join(tmpDir, ".codex", "config.toml"), "utf8");
    expect(config).toBe('approval_policy = "untrusted"\n');
    expect(config).not.toContain("model_provider");
    expect(config).not.toContain("model_catalog_json");
  });

  test("does not rewrite existing approval preferences on disk", async () => {
    const configPath = path.join(tmpDir, ".codex", "config.toml");
    await mkdir(path.dirname(configPath), { recursive: true });
    await writeFile(configPath, 'approval_policy = "on-request"\n', "utf8");

    await ensureCodexGenericUserDefaults(tmpDir);

    await expect(readFile(configPath, "utf8")).resolves.toBe('approval_policy = "on-request"\n');
  });

  test("does not add defaults to existing config without approval preferences", async () => {
    const configPath = path.join(tmpDir, ".codex", "config.toml");
    const raw = ['model = "gpt-5.5"', "", '[projects."/repo"]', 'trust_level = "trusted"', ""].join(
      "\n",
    );
    await mkdir(path.dirname(configPath), { recursive: true });
    await writeFile(configPath, raw, "utf8");

    await ensureCodexGenericUserDefaults(tmpDir);

    await expect(readFile(configPath, "utf8")).resolves.toBe(raw);
  });

  test("recognizes explicit user-config bypass", () => {
    expect(codexArgsIgnoreUserConfig(["exec", "--ignore-user-config", "hi"])).toBe(true);
    expect(codexArgsIgnoreUserConfig(["exec", "hi"])).toBe(false);
  });
});
