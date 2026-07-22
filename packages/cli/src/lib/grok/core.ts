import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { SELECTABLE_MODELS, TOGETHER_BASE_URL, VISION_PRIMARY } from "@togetherlink/models";
import type { ModelDefinition } from "@togetherlink/models";

export const GROK_API_KEY_ENV = "TOGETHER_API_KEY";
export const GROK_XAI_API_KEY_ENV = "XAI_API_KEY";
export const GROK_MAX_COMPLETION_TOKENS = 8192;
export const GROK_IDENTITY_RULE =
  "Grok Build is only the terminal harness. You are the selected Together AI model via togetherlink, not Grok or an xAI model. For identity questions, name the selected backend and Together AI; never claim xAI built or serves you.";

export function buildGrokIdentityRule(model: ModelDefinition): string {
  return `Grok Build is only the terminal harness. You are ${model.name} (${model.id}), served by Together AI via togetherlink. You are not Grok or an xAI model. For identity questions, name this backend and Together AI; never claim xAI built or serves you.`;
}

export type GrokCatalogEntry = {
  id: string;
  model: string;
  name: string;
  description: string;
  base_url: string;
  api_backend: "chat_completions";
  context_window: number;
  max_completion_tokens: number;
  user_selectable: true;
};

export type GrokModelCatalog = {
  object: "list";
  data: GrokCatalogEntry[];
};

/**
 * Grok 0.2.109 expects an OpenAI-style `{ data: [...] }` model response,
 * while Together's `/models` endpoint returns the array directly. This is
 * metadata only; every completion still goes straight to `baseUrl`.
 */
export function buildGrokModelCatalog(baseUrl = TOGETHER_BASE_URL): GrokModelCatalog {
  return {
    object: "list",
    data: SELECTABLE_MODELS.map((model) => ({
      id: model.id,
      model: model.id,
      name: `Together AI · ${model.name}`,
      description: `Direct Together API model: ${model.id}`,
      base_url: baseUrl,
      api_backend: "chat_completions",
      context_window: model.limit.context,
      max_completion_tokens: Math.min(model.limit.output, GROK_MAX_COMPLETION_TOKENS),
      user_selectable: true,
    })),
  };
}

export type GrokModelCatalogServer = {
  modelsListUrl: string;
  close: () => Promise<void>;
};

export async function startGrokModelCatalogServer(
  baseUrl = TOGETHER_BASE_URL,
): Promise<GrokModelCatalogServer> {
  const body = JSON.stringify(buildGrokModelCatalog(baseUrl));
  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    if (request.method === "GET" && pathname === "/v1/models") {
      response.writeHead(200, {
        "cache-control": "no-store",
        "content-length": Buffer.byteLength(body),
        "content-type": "application/json; charset=utf-8",
      });
      response.end(body);
      return;
    }

    response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    response.end('{"error":"not_found"}');
  });

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    server.once("error", onError);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", onError);
      resolve();
    });
  });

  const address = server.address() as AddressInfo;
  return {
    modelsListUrl: `http://127.0.0.1:${address.port}/v1/models`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

export function buildGrokLaunchEnvironment({
  inheritedEnv,
  apiKey,
  authPath,
  baseUrl,
  modelsListUrl,
  selectedModel,
}: {
  inheritedEnv: NodeJS.ProcessEnv;
  apiKey: string;
  authPath: string;
  baseUrl: string;
  modelsListUrl: string;
  selectedModel: ModelDefinition;
}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...inheritedEnv,
    [GROK_API_KEY_ENV]: apiKey,
    [GROK_XAI_API_KEY_ENV]: apiKey,
    GROK_AUTH_PATH: authPath,
    GROK_MODELS_BASE_URL: baseUrl,
    GROK_MODELS_LIST_URL: modelsListUrl,
    GROK_DEFAULT_MODEL: selectedModel.id,
    GROK_SESSION_SUMMARY_MODEL: selectedModel.id,
    GROK_IMAGE_DESCRIPTION_MODEL: VISION_PRIMARY.id,
    GROK_PROMPT_SUGGESTIONS_MODEL: selectedModel.id,
    GROK_SUGGESTIONS_AI_MODEL: selectedModel.id,
    GROK_WORKFLOWS: "1",
    // Grok's Imagine tools call api.x.ai directly with the active API key and
    // an xAI-only image model. Do not expose those tools while tgrok supplies a
    // Together key; image routing needs a dedicated Together integration.
    GROK_IMAGE_GEN: "0",
    GROK_IMAGE_EDIT: "0",
    GROK_TELEMETRY_ENABLED: "0",
    GROK_FEEDBACK_ENABLED: "0",
  };

  // GROK_AUTH is inline session auth and outranks GROK_AUTH_PATH. Togetherlink
  // must use the supplied Together key even when the user's normal Grok login
  // is active. The user's auth file itself remains untouched.
  delete env.GROK_AUTH;
  delete env.GROK_DISABLE_API_KEY_AUTH;

  // A blank override points Grok at the current directory. Treat it as unset so
  // Grok resolves its normal ~/.grok home and keeps every built-in resource.
  if (!env.GROK_HOME?.trim()) delete env.GROK_HOME;

  return env;
}

export function grokArgsWithoutTogetherlinkOverrides(args: string[]): string[] {
  const sanitized: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) continue;
    if (arg === "--model" || arg === "-m") {
      index += 1;
      continue;
    }
    if (arg.startsWith("--model=") || (arg.startsWith("-m") && arg.length > 2)) continue;
    sanitized.push(arg);
  }
  return sanitized;
}

export function grokArgsWithTogetherlinkIdentity(
  args: string[],
  identityRule = GROK_IDENTITY_RULE,
): string[] {
  const sanitized = grokArgsWithoutTogetherlinkOverrides(args);
  const passthrough: string[] = [];
  const userRules: string[] = [];
  let systemPromptOverride: string | undefined;

  for (let index = 0; index < sanitized.length; index += 1) {
    const arg = sanitized[index];
    if (arg === undefined) continue;

    if (arg === "--disable-web-search") {
      continue;
    }

    if (arg === "--rules" || arg === "--append-system-prompt") {
      const value = sanitized[index + 1];
      if (value !== undefined) {
        userRules.push(value);
        index += 1;
      }
      continue;
    }
    if (arg.startsWith("--rules=") || arg.startsWith("--append-system-prompt=")) {
      userRules.push(arg.slice(arg.indexOf("=") + 1));
      continue;
    }

    if (arg === "--system-prompt-override" || arg === "--system-prompt") {
      const value = sanitized[index + 1];
      if (value !== undefined) {
        systemPromptOverride = value;
        index += 1;
      }
      continue;
    }
    if (arg.startsWith("--system-prompt-override=") || arg.startsWith("--system-prompt=")) {
      systemPromptOverride = arg.slice(arg.indexOf("=") + 1);
      continue;
    }

    passthrough.push(arg);
  }

  if (systemPromptOverride !== undefined) {
    return [
      "--disable-web-search",
      `--system-prompt-override=${joinPromptRules(systemPromptOverride, identityRule)}`,
      ...passthrough,
    ];
  }

  return [
    "--disable-web-search",
    "--rules",
    joinPromptRules(identityRule, ...userRules),
    ...passthrough,
  ];
}

function joinPromptRules(...rules: string[]): string {
  return rules.filter((rule) => rule.trim().length > 0).join("\n\n");
}
