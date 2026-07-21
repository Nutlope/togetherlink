export const GUIDE_OG_VERSION = "7";

export const guideOgContent = {
  "glm-codex": {
    eyebrow: "Verified GLM 5.2 quickstart",
    title: "GLM 5.2 in Codex CLI: Install, Launch, Verify",
    titleLines: ["GLM 5.2 in Codex CLI:", "install, launch, verify"],
    titleSize: 56,
    harness: "codex",
    harnessLabel: "Codex CLI",
    command: "tcodex",
    model: "GLM 5.2",
    protocol: "Responses API",
    accent: "#e34d13",
    panelBorder: "#e5e7eb",
    tint: "#f4f4f3",
  },
  "together-codex": {
    eyebrow: "Config-safe Codex routing",
    title: "Run open models in Codex CLI without replacing your config",
    titleLines: ["Run open models in Codex", "without replacing config"],
    titleSize: 56,
    harness: "codex",
    harnessLabel: "Codex CLI",
    command: "tcodex",
    model: "6 open models",
    protocol: "Responses API",
    accent: "#e34d13",
    panelBorder: "#e5e7eb",
    tint: "#f4f4f3",
  },
  "together-claude": {
    eyebrow: "Named-model compatibility",
    title: "Connect Claude Code to GLM 5.2, Kimi, and MiniMax",
    titleLines: ["Connect Claude Code to", "GLM 5.2, Kimi + MiniMax"],
    titleSize: 54,
    harness: "claude",
    harnessLabel: "Claude Code",
    command: "tclaude",
    model: "GLM 5.2 + more",
    protocol: "Messages API",
    accent: "#c95535",
    panelBorder: "#f0dcd4",
    tint: "#faeee9",
  },
  "glm-grok": {
    eyebrow: "Default-model launch",
    title: "Launch Grok Build with GLM 5.2",
    titleLines: ["Launch Grok Build", "with GLM 5.2"],
    titleSize: 61,
    harness: "grok",
    harnessLabel: "Grok Build",
    command: "tgrok",
    model: "GLM 5.2",
    protocol: "Chat Completions",
    accent: "#e34d13",
    panelBorder: "#e5e7eb",
    tint: "#f4f4f3",
  },
  "together-chatgpt": {
    eyebrow: "Codex desktop provider",
    title: "Use open models in Codex for the ChatGPT Desktop app",
    titleLines: ["Use open models in Codex", "for ChatGPT Desktop"],
    titleSize: 54,
    harness: "chatgpt",
    harnessLabel: "ChatGPT Desktop",
    command: "togetherlink chatgpt",
    model: "Open models",
    protocol: "Responses API",
    accent: "#e34d13",
    panelBorder: "#e5e7eb",
    tint: "#f4f4f3",
  },
} as const;

export type GuideOgKey = keyof typeof guideOgContent;

export function isGuideOgKey(value: string | null): value is GuideOgKey {
  return value !== null && value in guideOgContent;
}

export function guideOgPath(guide: GuideOgKey): string {
  return `/api/og?guide=${encodeURIComponent(guide)}&v=${GUIDE_OG_VERSION}`;
}
