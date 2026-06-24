import os from "node:os";
import * as clack from "@clack/prompts";
import { ALL_HARNESSES, HARNESS_LABEL, type HarnessId } from "../harness.js";
import { isHarnessImplemented } from "../harness-registry.js";
import { detectInstalledHarnesses } from "../detect.js";
import { readGlobalConfig, setGlobalApiKey, resolveStoredApiKey, resolveStoredExaApiKey, setGlobalExaApiKey } from "../global-config.js";
import { EXA_API_KEY_ENV_REF } from "../together-core.js";
import { UPDATE_ORIGIN } from "../autoupdate.js";
import { VERSION } from "../version.js";

export function printHelp() {
  console.log(`togetherlink v${VERSION} — use Together AI models in OpenCode & Claude Code

Usage:
  togetherlink configure                Detect installed tools and set your Together API key
  togetherlink claude [run] [-- ...]    Launch Claude Code through a local Together proxy (ephemeral)
  tclaude [-- ...]                      Alias for: togetherlink claude
  togetherlink claude --main together-kimi-k2-7-code
                                      Launch Claude Code with Kimi K2.7 Code
  togetherlink claude status            Show Claude Code local proxy defaults
  togetherlink opencode [run] [-- ...]  Launch OpenCode with Together GLM 5.2 (ephemeral)
  topencode [-- ...]                    Alias for: togetherlink opencode
  togetherlink opencode status          Show OpenCode ephemeral defaults
  togetherlink codex [run] [-- ...]     Launch Codex through a local Responses proxy (ephemeral)
  togetherlink codex -- exec "Say hi"   Run Codex headlessly through Together
  togetherlink daemon status            Show the shared proxy daemon status
  togetherlink daemon stop              Stop the shared proxy daemon
  togetherlink --version                Show the CLI version
  togetherlink help                     Show this message

The CLI always keeps itself up to date from ${UPDATE_ORIGIN}.
`);
}

export async function runConfigure() {
  const home = os.homedir();
  clack.intro("togetherlink configure");

  const detected = detectInstalledHarnesses();
  const notImplemented = ALL_HARNESSES.filter((h) => !isHarnessImplemented(h));

  const lines = ALL_HARNESSES.map((h) => {
    const found = detected[h].installed ? "found" : "not found";
    const support = isHarnessImplemented(h) ? " (ephemeral launcher)" : " (support coming later)";
    return `  ${HARNESS_LABEL[h]}: ${found}${support}`;
  });
  clack.log.info(`Detected tools:\n${lines.join("\n")}`);

  const existing = resolveStoredApiKey((await readGlobalConfig(home)).apiKey);
  let apiKey = existing || process.env.TOGETHER_API_KEY || "";
  if (!apiKey) {
    const entered = await clack.password({
      message: "Together API key (from https://api.together.ai/settings/api-keys):",
      validate: (value) => (value.trim() ? undefined : "An API key is required"),
    });
    if (clack.isCancel(entered)) {
      clack.cancel("Cancelled.");
      return;
    }
    apiKey = entered.trim();
  }
  await setGlobalApiKey(home, apiKey);

  // Exa powers the proxy's native web_search emulation for Claude Code. It's
  // optional — without it, searches return a clear "EXA_API_KEY not set" error
  // rather than failing silently — so allow skipping.
  const existingExa = resolveStoredExaApiKey((await readGlobalConfig(home)).exaApiKey);
  let exaApiKey = existingExa || process.env.EXA_API_KEY || "";
  if (!exaApiKey) {
    const enteredExa = await clack.password({
      message: "Exa API key for web search (from https://exa.ai — press Enter to skip; web search will be disabled):",
      validate: (value) => (value.trim() || value === "" ? undefined : undefined),
    });
    if (clack.isCancel(enteredExa)) {
      clack.cancel("Cancelled.");
      return;
    }
    exaApiKey = enteredExa.trim();
  }
  // If the key came from the environment, store a reference rather than the
  // literal, so we don't persist a secret that lives in .env.
  const exaToStore =
    exaApiKey && process.env.EXA_API_KEY && exaApiKey === process.env.EXA_API_KEY.trim()
      ? EXA_API_KEY_ENV_REF
      : exaApiKey;
  await setGlobalExaApiKey(home, exaToStore);
  if (exaApiKey) {
    clack.log.success("Exa web search enabled.");
  } else {
    clack.log.info("Exa key skipped — web search will be unavailable in Claude Code.");
  }

  const launchable = ALL_HARNESSES.filter(
    (h) => isHarnessImplemented(h) && detected[h as HarnessId].installed,
  );
  if (launchable.length > 0) {
    clack.log.info(
      `Ready to launch: ${launchable
        .map((h) => HARNESS_LABEL[h])
        .join(", ")}. Run \`togetherlink <harness>\` to start — nothing is written to disk.`,
    );
  }

  if (notImplemented.length > 0) {
    clack.log.info(
      `${notImplemented.map((h) => HARNESS_LABEL[h]).join(" and ")} support is coming in a later phase (needs a local translation proxy).`,
    );
  }

  clack.outro("Done. Run `togetherlink help` to see everything available.");
}
