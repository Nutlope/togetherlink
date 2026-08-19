import type { HarnessId } from "./harness.js";

export type InteractiveLauncherChoice = HarnessId | "chatgpt" | "configure" | "show-more";

export interface InteractiveLauncherOption {
  value: InteractiveLauncherChoice;
  label: string;
  hint: string;
}

const COMMON_HARNESSES: readonly InteractiveLauncherOption[] = [
  { value: "chatgpt", label: "ChatGPT Desktop", hint: "chatgpt" },
  { value: "claude", label: "Claude Code", hint: "tclaude" },
  { value: "codex", label: "Codex CLI", hint: "tcodex" },
  { value: "opencode", label: "OpenCode", hint: "topencode" },
  { value: "pi", label: "Pi Code", hint: "tpi" },
];

const LESS_COMMON_HARNESSES: readonly InteractiveLauncherOption[] = [
  { value: "deepseek", label: "DeepSeek Harness (alpha)", hint: "tdeepseek" },
  { value: "grok", label: "Grok Build", hint: "tgrok" },
  { value: "hermes", label: "Hermes Agent", hint: "thermes" },
  { value: "prime", label: "Prime Agent", hint: "tprime" },
];

const CONFIGURE: InteractiveLauncherOption = {
  value: "configure",
  label: "Configure",
  hint: "API keys and detected tools",
};

const SHOW_MORE: InteractiveLauncherOption = {
  value: "show-more",
  label: "Show more",
  hint: "DeepSeek, Grok, Hermes, and Prime",
};

export function interactiveLauncherOptions(expanded = false): InteractiveLauncherOption[] {
  if (expanded) {
    return [...COMMON_HARNESSES, ...LESS_COMMON_HARNESSES, CONFIGURE];
  }
  return [...COMMON_HARNESSES, CONFIGURE, SHOW_MORE];
}
