import os from "node:os";
import * as clack from "@clack/prompts";
import { ALL_HARNESSES, HARNESS_LABEL, type HarnessId } from "../harness.js";
import { isHarnessConfigurable, isHarnessImplemented, loadHarness } from "../harness-registry.js";
import { detectInstalledHarnesses } from "../detect.js";
import { readGlobalConfig, setGlobalApiKey, resolveStoredApiKey } from "../global-config.js";

export function printHelp() {
  console.log(`togetherlink — use Together AI models in Claude Code, OpenCode, and Codex

Usage:
  togetherlink configure              Detect installed tools, set your Together API key, configure them
  togetherlink claude [run] [-- ...]  Launch Claude Code through a local Together proxy (ephemeral)
  togetherlink claude status          Show Claude Code local proxy defaults
  togetherlink opencode on|off|status Register/unregister Together as an OpenCode provider (persistent)
  togetherlink codex ...              Coming soon (needs a local translation proxy)
  togetherlink help                   Show this message
`);
}

export async function runConfigure() {
  const home = os.homedir();
  clack.intro("togetherlink configure");

  const detected = detectInstalledHarnesses();
  const implemented = ALL_HARNESSES.filter((h) => isHarnessImplemented(h));
  const configurable: HarnessId[] = [];
  for (const harness of implemented) {
    if (await isHarnessConfigurable(harness)) {
      configurable.push(harness);
    }
  }
  const notImplemented = ALL_HARNESSES.filter((h) => !isHarnessImplemented(h));

  const lines = ALL_HARNESSES.map((h) => {
    const found = detected[h].installed ? "found" : "not found";
    const support = isHarnessImplemented(h)
      ? configurable.includes(h)
        ? ""
        : " (ephemeral launcher)"
      : " (support coming later)";
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

  const toConfigure: HarnessId[] = [];
  for (const harness of configurable) {
    if (detected[harness].installed) {
      toConfigure.push(harness);
      continue;
    }
    const preconfigure = await clack.confirm({
      message: `${HARNESS_LABEL[harness]} isn't installed yet — pre-configure it anyway so it's ready when you install it?`,
      initialValue: false,
    });
    if (clack.isCancel(preconfigure)) {
      clack.cancel("Cancelled.");
      return;
    }
    if (preconfigure) {
      toConfigure.push(harness);
    }
  }

  for (const harness of toConfigure) {
    const spinner = clack.spinner();
    spinner.start(`Configuring ${HARNESS_LABEL[harness]}`);
    try {
      const harnessModule = await loadHarness(harness);
      if (!harnessModule.on) {
        throw new Error(`${HARNESS_LABEL[harness]} is not a persistent configurable harness.`);
      }
      const result = await harnessModule.on({ home, apiKey });
      spinner.stop(result?.message ?? `${HARNESS_LABEL[harness]} configured.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      spinner.stop(`${HARNESS_LABEL[harness]} failed: ${message}`, 1);
    }
  }

  if (notImplemented.length > 0) {
    clack.log.info(
      `${notImplemented.map((h) => HARNESS_LABEL[h]).join(" and ")} support is coming in a later phase (needs a local translation proxy).`,
    );
  }

  clack.outro("Done. Run `togetherlink help` to see everything available.");
}
