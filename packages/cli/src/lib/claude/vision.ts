import { createHash } from "node:crypto";
import { TOGETHER_BASE_URL, VISION_MODELS, VISION_PROMPT } from "@togetherlink/models";

/**
 * Image interception for the Claude proxy. GLM-5.2 is text-only, so when Claude
 * Code sends an Anthropic `image` block we can't pass it through. Instead we
 * route each image to a vision-capable Together serverless model, get a text
 * description back, and let the caller substitute a `text` block in its place —
 * so GLM-5.2 reasons over the description rather than hallucinating about an
 * image it never saw.
 *
 * The vision model list and prompt come from @togetherlink/models (the shared
 * manifest) so they stay in sync with the OpenCode `@vision` subagent. The
 * models are fixed here — not user-configurable — with automatic failover if
 * the primary errors. Reasoning is disabled because image description is a
 * perception task, not a reasoning one.
 */

export type ImageBlock = {
  type: "image";
  source: {
    type: string; // "base64" | "url"
    media_type?: string;
    data?: string;
    url?: string;
  };
};

export type UrlBlock = {
  type: "url";
  url: string;
};

export type VisionRequestOptions = {
  apiKey: string;
  debug?: boolean | undefined;
};

/** Whether a content block is an image we should intercept. */
export function isImageBlock(block: unknown): block is ImageBlock {
  return typeof block === "object" && block !== null && (block as { type?: string }).type === "image";
}

/** Whether a content block is a URL image (newer Anthropic beta form). */
export function isUrlImageBlock(block: unknown): block is UrlBlock {
  return typeof block === "object" && block !== null && (block as { type?: string }).type === "url";
}

type VisionOutcome =
  | { ok: true; description: string; model: string; usage: { promptTokens: number; completionTokens: number; cachedTokens: number } }
  | { ok: false; error: string; model: string };

async function callVisionModel(model: string, imageUrl: string, options: VisionRequestOptions): Promise<VisionOutcome> {
  const body = {
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: VISION_PROMPT },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    // Perception, not reasoning — keep reasoning off so content isn't empty.
    reasoning: { enabled: false },
    temperature: 0.6,
    top_p: 0.95,
    max_tokens: 800,
    stream: false,
  };

  try {
    const response = await fetch(`${TOGETHER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) {
      debug(options, "vision error", { model, status: response.status, body: text.slice(0, 500) });
      return { ok: false, model, error: `vision model returned ${response.status}` };
    }
    let json: {
      choices?: Array<{ message?: { content?: string | null; reasoning?: string | null } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; cached_tokens?: number };
    };
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, model, error: "vision model returned non-JSON" };
    }
    const message = json.choices?.[0]?.message;
    const description = (message?.content || message?.reasoning || "").trim();
    if (!description) {
      return { ok: false, model, error: "vision model returned empty content" };
    }
    const usage = json.usage ?? {};
    return {
      ok: true,
      model,
      description,
      usage: {
        promptTokens: usage.prompt_tokens ?? 0,
        completionTokens: usage.completion_tokens ?? 0,
        cachedTokens: usage.cached_tokens ?? 0,
      },
    };
  } catch (err) {
    debug(options, "vision error", { model, error: err instanceof Error ? err.message : String(err) });
    return { ok: false, model, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Describe a single image using the curated vision models, with automatic
 * failover from primary to fallback. Returns a text description plus the model
 * that produced it, or a short error string if every model failed (so GLM-5.2
 * still gets a usable placeholder rather than nothing).
 */
export async function describeImage(
  block: ImageBlock | UrlBlock,
  options: VisionRequestOptions,
): Promise<{ description: string; model: string; usage?: { promptTokens: number; completionTokens: number; cachedTokens: number } }> {
  const imageUrl = toDataUrl(block);
  if (!imageUrl) {
    return { description: "[Image unavailable: could not read image data]", model: "none" };
  }

  for (const model of VISION_MODELS) {
    const outcome = await callVisionModel(model.id, imageUrl, options);
    if (outcome.ok) {
      return { description: outcome.description, model: outcome.model, usage: outcome.usage };
    }
    debug(options, "vision fallback", { from: outcome.model, reason: outcome.error });
  }
  return { description: "[Image description unavailable: all vision models failed]", model: "none" }
}

/** Convert an Anthropic image/url block into an OpenAI `image_url` data URL. */
function toDataUrl(block: ImageBlock | UrlBlock): string | null {
  if (isImageBlock(block)) {
    const { source } = block;
    if (source.type === "base64" && source.data && source.media_type) {
      return `data:${source.media_type};base64,${source.data}`;
    }
    if (source.type === "url" && source.url) {
      return source.url;
    }
    return null;
  }
  // url block
  return block.url;
}

/** Stable cache key for an image block so the same image isn't re-described. */
export function imageBlockKey(block: ImageBlock | UrlBlock): string {
  if (isImageBlock(block)) {
    const { source } = block;
    if (source.type === "base64" && source.data) {
      return `base64:${source.media_type ?? ""}:${createHash("sha256").update(source.data).digest("hex")}`;
    }
    if (source.type === "url" && source.url) {
      return `url:${source.url}`;
    }
    return `unknown:${JSON.stringify(source)}`;
  }
  return `url:${block.url}`;
}

function debug(options: VisionRequestOptions, label: string, value: unknown): void {
  if (!options.debug) {
    return;
  }
  process.stderr.write(`[togetherlink vision] ${label}: ${JSON.stringify(value)}\n`);
}
