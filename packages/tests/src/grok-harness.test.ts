import { lstatSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { GLM_5_2, SELECTABLE_MODELS } from "@togetherlink/models";
import {
  buildGrokConfigToml,
  grokArgsWithoutTogetherlinkOverrides,
  grokArgsWithTogetherlinkIdentity,
  grokModelAlias,
  GROK_IDENTITY_RULE,
  GROK_VISION_MODEL_ALIAS,
  populateTemporaryGrokHome,
} from "../../cli/src/lib/grok/core.js";

const cleanup: string[] = [];

afterEach(() => {
  for (const path of cleanup.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe("Grok harness", () => {
  test("builds an explicit direct-Together catalog without embedding the key", () => {
    const config = buildGrokConfigToml(GLM_5_2);

    expect(config).toContain(`default = "${grokModelAlias(GLM_5_2)}"`);
    expect(config).toContain(`session_summary = "${grokModelAlias(GLM_5_2)}"`);
    expect(config).toContain(`image_description = "${GROK_VISION_MODEL_ALIAS}"`);
    expect(config).toContain('base_url = "https://api.together.ai/v1"');
    expect(config).toContain('env_key = "TOGETHER_API_KEY"');
    expect(config).toContain('api_backend = "chat_completions"');
    expect(config).not.toContain("tgp_v1_");
    for (const model of SELECTABLE_MODELS) {
      expect(config).toContain(`[model.${grokModelAlias(model)}]`);
      expect(config).toContain(`model = "${model.id}"`);
    }
  });

  test("removes Grok model overrides owned by togetherlink", () => {
    expect(
      grokArgsWithoutTogetherlinkOverrides([
        "--model",
        "xai-model",
        "-mother-model",
        "--model=other-model",
        "-mthird-model",
        "-p",
        "hello",
      ]),
    ).toEqual(["-p", "hello"]);
  });

  test("appends Togetherlink identity while preserving user prompt rules", () => {
    expect(
      grokArgsWithTogetherlinkIdentity(["--rules", "Always use pnpm.", "-p", "hello"]),
    ).toEqual(["--rules", `${GROK_IDENTITY_RULE}\n\nAlways use pnpm.`, "-p", "hello"]);

    expect(
      grokArgsWithTogetherlinkIdentity([
        "--system-prompt-override=You are a coding agent.",
        "-p",
        "hello",
      ]),
    ).toEqual([
      `--system-prompt-override=You are a coding agent.\n\n${GROK_IDENTITY_RULE}`,
      "-p",
      "hello",
    ]);
  });

  test("isolates config while preserving sessions and user settings", () => {
    const root = mkdtempSync(join(tmpdir(), "togetherlink-grok-unit-"));
    cleanup.push(root);
    const persistentHome = join(root, "persistent");
    const temporaryHome = join(root, "temporary");
    mkdirSync(join(persistentHome, "sessions"), { recursive: true });
    writeFileSync(join(persistentHome, "config.toml"), "[ui]\nvim_mode = true\n", "utf8");

    populateTemporaryGrokHome({
      temporaryHome,
      persistentHome,
      selectedModel: GLM_5_2,
    });

    expect(lstatSync(join(temporaryHome, "sessions")).isSymbolicLink()).toBe(true);
    expect(readFileSync(join(temporaryHome, "managed_config.toml"), "utf8")).toContain(
      "vim_mode = true",
    );
    expect(readFileSync(join(temporaryHome, "config.toml"), "utf8")).toContain(
      `default = "${grokModelAlias(GLM_5_2)}"`,
    );
    expect(readFileSync(join(persistentHome, "config.toml"), "utf8")).toBe(
      "[ui]\nvim_mode = true\n",
    );
  });
});
