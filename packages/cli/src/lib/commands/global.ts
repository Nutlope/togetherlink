import os from "node:os";
import * as clack from "@clack/prompts";
import { ALL_HARNESSES, HARNESS_LABEL, type HarnessId } from "../harness.js";
import { isHarnessImplemented } from "../harness-registry.js";
import { detectInstalledHarnesses } from "../detect.js";
import {
  readGlobalConfig,
  setGlobalApiKey,
  resolveStoredApiKey,
  resolveStoredExaApiKey,
  setGlobalExaApiKey,
} from "../global-config.js";
import { EXA_API_KEY_ENV_REF } from "../together-core.js";
import { VERSION } from "../version.js";

export function printHelp() {
  console.log(`togetherlink v${VERSION} — Together AI for coding CLIs

Usage:
  togetherlink configure
  togetherlink whoami
  togetherlink codex-app [--model <model>] [--restore]  (alpha)
  togetherlink codex [...]       (alias: tcodex)
  togetherlink claude [...]      (alias: tclaude)
  togetherlink pi [...]          (alias: tpi)
  togetherlink opencode [...]    (alias: topencode)

Extra args after codex/claude/pi/opencode are passed through.
Codex App support is alpha; run \`togetherlink codex-app --restore\` to restore the previous desktop config.

Docs: https://togetherlink.vercel.app/llms.txt
  LLM-readable documentation — if you are an AI agent asked to install, configure,
  or use togetherlink (including headless use), read that file first.
`);
}

export async function runConfigure(): Promise<boolean> {
  const home = os.homedir();
  clack.intro("togetherlink configure");

  const detected = detectInstalledHarnesses();
  const notImplemented = ALL_HARNESSES.filter((h) => !isHarnessImplemented(h));

  const lines = ALL_HARNESSES.map((h) => {
    const found = detected[h].installed ? "found" : "not found";
    const support = isHarnessImplemented(h) ? " (ephemeral settings)" : " (support coming later)";
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
      return false;
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
      message:
        "Exa API key for web search (from https://exa.ai — press Enter to skip; web search will be disabled):",
      validate: (value) => (value.trim() || value === "" ? undefined : undefined),
    });
    if (clack.isCancel(enteredExa)) {
      clack.cancel("Cancelled.");
      return false;
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

  clack.outro("Done.");
  return true;
}
