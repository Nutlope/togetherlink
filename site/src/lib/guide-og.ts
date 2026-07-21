export const GUIDE_OG_VERSION = "5";

export const guideOgContent = {
  "glm-codex": {
    eyebrow: "GLM 5.2 quickstart",
    title: "How to use GLM 5.2 in Codex CLI",
    titleLines: ["How to use GLM 5.2", "in Codex CLI"],
    titleSize: 63,
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
    eyebrow: "Open models in Codex",
    title: "How to use open source models in Codex CLI",
    titleLines: ["How to use open models", "in Codex CLI"],
    titleSize: 61,
    harness: "codex",
    harnessLabel: "Codex CLI",
    command: "togetherlink codex",
    model: "6 open models",
    protocol: "Responses API",
    accent: "#e34d13",
    panelBorder: "#e5e7eb",
    tint: "#f4f4f3",
  },
  "together-claude": {
    eyebrow: "Open models in Claude Code",
    title: "How to use open source models in Claude Code",
    titleLines: ["How to use open models", "in Claude Code"],
    titleSize: 59,
    harness: "claude",
    harnessLabel: "Claude Code",
    command: "togetherlink claude",
    model: "GLM 5.2 + more",
    protocol: "Messages API",
    accent: "#c95535",
    panelBorder: "#f0dcd4",
    tint: "#faeee9",
  },
  "glm-grok": {
    eyebrow: "GLM 5.2 in Grok Build",
    title: "How to use GLM 5.2 with Grok Build",
    titleLines: ["How to use GLM 5.2", "with Grok Build"],
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
    eyebrow: "Open models in ChatGPT",
    title: "How to use open source models in ChatGPT Desktop",
    titleLines: ["How to use open models", "in ChatGPT Desktop"],
    titleSize: 57,
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
