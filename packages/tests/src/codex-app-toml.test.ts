import { describe, expect, test } from "vitest";
import {
  removeManagedBlock,
  removeTomlSections,
  splitTomlPreamble,
  upsertTopLevelTomlKeys,
  removeTopLevelTomlKeys,
  tomlString,
} from "@togetherlink/cli/dist/lib/codex-app/toml.js";

const START = "# >>> togetherlink codex-app alpha >>>";
const END = "# <<< togetherlink codex-app alpha <<<";

describe("codex-app/toml.ts — pure TOML preamble manipulation (#4)", () => {
  test("removeManagedBlock strips a marked block cleanly", () => {
    const raw = `model = "old"\n${START}\n[model_providers.foo]\nname = "x"\n${END}\nprofile = "y"`;
    const out = removeManagedBlock(raw, START, END);
    expect(out).not.toContain(START);
    expect(out).not.toContain("[model_providers.foo]");
    expect(out).toContain('model = "old"');
    expect(out).toContain('profile = "y"');
  });

  test("removeManagedBlock is a no-op when the marker is absent", () => {
    const raw = 'model = "x"\n';
    expect(removeManagedBlock(raw, START, END)).toBe(raw);
  });

  test("removeTomlSections drops a named table and its keys", () => {
    const raw = "[a]\nx = 1\n[b]\ny = 2\n[c]\nz = 3";
    const out = removeTomlSections(raw, ["b"]);
    expect(out).not.toContain("[b]");
    expect(out).not.toContain("y = 2");
    expect(out).toContain("[a]");
    expect(out).toContain("[c]");
  });

  test("splitTomlPreamble separates top-level keys from the first table", () => {
    const raw = 'model = "x"\nprofile = "y"\n[model_providers.foo]\nname = "bar"';
    const [preamble, rest] = splitTomlPreamble(raw);
    expect(preamble).toBe('model = "x"\nprofile = "y"\n');
    expect(rest).toBe('[model_providers.foo]\nname = "bar"');
  });

  test("upsertTopLevelTomlKeys updates existing keys and appends new ones", () => {
    const preamble = 'model = "old"\nother = "keep"';
    const out = upsertTopLevelTomlKeys(preamble, {
      model: '"new"',
      model_provider: '"togetherlink"',
    });
    expect(out).toContain('model = "new"');
    expect(out).toContain('model_provider = "togetherlink"');
    expect(out).toContain('other = "keep"');
  });

  test("removeTopLevelTomlKeys strips only the named keys", () => {
    const preamble = 'model = "x"\nprofile = "y"\nkeep = "z"';
    const out = removeTopLevelTomlKeys(preamble, ["model", "profile"]);
    expect(out).not.toContain("model =");
    expect(out).not.toContain("profile =");
    expect(out).toContain('keep = "z"');
  });

  test("tomlString quotes a string value", () => {
    expect(tomlString("togetherlink")).toBe('"togetherlink"');
    expect(tomlString('with "quotes"')).toBe('"with \\"quotes\\""');
  });

  test("buildCodexAppConfig-style composition round-trips through the helpers", () => {
    // Simulates the sequence in buildCodexAppConfig at a smaller scale: the
    // point is that the helpers compose correctly when chained.
    const raw = 'model = "old"\nprofile = "y"\n[model_providers.legacy]\nname = "x"';
    const step1 = removeTomlSections(raw, ["model_providers.legacy"]);
    const [preamble, rest] = splitTomlPreamble(step1);
    const step3 = upsertTopLevelTomlKeys(preamble, { model: '"new"' });
    const step4 = removeTopLevelTomlKeys(step3, ["profile"]);
    expect(step4).toContain('model = "new"');
    expect(step4).not.toContain("profile");
    expect(rest).toBe("");
  });
});
