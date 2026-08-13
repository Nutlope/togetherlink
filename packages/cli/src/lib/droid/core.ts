import { createHash } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ModelDefinition } from "@togetherlink/models";
import { CODEX_SUPPORTED_MODELS, type CodexModelSelection } from "../codex/defaults.js";
import { TOGETHER_BASE_URL } from "../together-core.js";

export const DROID_API_KEY_ENV = "TOGETHER_API_KEY";
export const DROID_PROVIDER = "generic-chat-completion-api" as const;

export type DroidCustomModel = {
  model: string;
  displayName: string;
  baseUrl: string;
  apiKey: string;
  provider: typeof DROID_PROVIDER;
  maxOutputTokens: number;
  noImageSupport?: true;
};

export type DroidSettings = {
  model: string;
  cloudSessionSync: false;
  customModels: DroidCustomModel[];
};

export type DroidLaunchSpec = {
  binary: "droid";
  args: string[];
  env: NodeJS.ProcessEnv;
};

const VALUE_FLAGS = new Set(["--settings", "--model", "-m"]);

function droidDisplayName(model: ModelDefinition): string {
  return `Together AI ${model.name}`;
}

export function droidCustomModelId(model: ModelDefinition, index: number): string {
  return `custom:${droidDisplayName(model).replaceAll(" ", "-")}-${index}`;
}

export function buildDroidSettings({
  selectedModel,
  baseUrl = TOGETHER_BASE_URL,
}: {
  selectedModel: CodexModelSelection;
  baseUrl?: string;
}): DroidSettings {
  const customModels = CODEX_SUPPORTED_MODELS.map(({ definition }) => ({
    model: definition.id,
    displayName: droidDisplayName(definition),
    baseUrl,
    apiKey: `\${${DROID_API_KEY_ENV}}`,
    provider: DROID_PROVIDER,
    maxOutputTokens: definition.limit.output,
    ...(!definition.attachment ? { noImageSupport: true as const } : {}),
  }));
  const selectedIndex = CODEX_SUPPORTED_MODELS.findIndex(({ id }) => id === selectedModel.id);
  if (selectedIndex < 0) {
    throw new Error(`Droid model "${selectedModel.id}" is not in the curated model catalog.`);
  }

  return {
    model: droidCustomModelId(selectedModel.definition, selectedIndex),
    // Keep TogetherLink sessions local. Factory authentication is still used
    // by Droid, but transcripts should not be mirrored to Factory by default.
    cloudSessionSync: false,
    customModels,
  };
}

export function resolveDroidSettingsPath(
  home: string,
  baseUrl = TOGETHER_BASE_URL,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const togetherlinkRoot = env.TOGETHERLINK_HOME?.trim() || join(home, ".togetherlink");
  const endpointHash = createHash("sha256").update(baseUrl).digest("hex").slice(0, 12);
  return join(togetherlinkRoot, "droid", `settings-${endpointHash}.json`);
}

export async function writeDroidSettings(filePath: string, settings: DroidSettings): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  await writeFile(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
  await rename(temporaryPath, filePath);
}

export function droidArgsWithoutTogetherlinkOverrides(args: string[]): string[] {
  const sanitized: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) {
      continue;
    }
    if (arg === "--") {
      sanitized.push(...args.slice(index));
      break;
    }
    if (VALUE_FLAGS.has(arg)) {
      index += 1;
      continue;
    }
    if (arg.startsWith("--settings=") || arg.startsWith("--model=")) {
      continue;
    }
    sanitized.push(arg);
  }
  return sanitized;
}

export function buildDroidLaunchSpec({
  selectedModel: _selectedModel,
  apiKey,
  settingsPath,
  passthrough,
  env = process.env,
}: {
  selectedModel: CodexModelSelection;
  apiKey: string;
  settingsPath: string;
  passthrough: string[];
  env?: NodeJS.ProcessEnv;
}): DroidLaunchSpec {
  return {
    binary: "droid",
    args: ["--settings", settingsPath, ...droidArgsWithoutTogetherlinkOverrides(passthrough)],
    // Preserve HOME and Factory's auth environment. Only the Together key is
    // overlaid for the custom models referenced by the runtime settings file.
    env: { ...env, TOGETHER_API_KEY: apiKey },
  };
}
