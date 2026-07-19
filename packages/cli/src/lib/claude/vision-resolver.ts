import { CostTracker } from "../cost.js";
import { writeProxyDebugLog } from "../proxy-debug.js";
import {
  describeImage,
  imageBlockKey,
  isImageBlock,
  isUrlImageBlock,
  type ImageBlock,
  type UrlBlock,
} from "./vision.js";
import type { AnthropicContentBlock, AnthropicMessagesRequest } from "./wire-types.js";

type ClaudeVisionOptions = {
  apiKey: string;
  baseUrl: string;
  debug?: boolean | undefined;
  costTracker?: CostTracker | undefined;
};

/**
 * Small bounded LRU keyed by string. Uses a Map's insertion-order semantics:
 * `get` re-inserts (delete + set) to move the entry to the most-recently-used
 * position; `set` evicts the oldest entry (the Map's first key) while the entry
 * count or the approximate byte total exceeds the cap. No timers, no external
 * deps — just stdlib. The `byteSize` of a value defaults to its string length
 * (good enough for ASCII-dominant description text).
 */
class LruCache<K, V> {
  private readonly map = new Map<K, V>();
  private readonly maxEntries: number;
  private readonly maxBytes: number;
  private readonly sizeOf: (value: V) => number;
  private bytes = 0;

  constructor(maxEntries: number, maxBytes: number, sizeOf?: (value: V) => number) {
    this.maxEntries = maxEntries;
    this.maxBytes = maxBytes;
    this.sizeOf = sizeOf ?? ((value) => (typeof value === "string" ? value.length : 1));
  }

  get(key: K): V | undefined {
    if (!this.map.has(key)) {
      return undefined;
    }
    const value = this.map.get(key) as V;
    // Move to most-recently-used: delete + re-insert.
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    const existing = this.map.get(key);
    if (existing !== undefined) {
      this.bytes -= this.sizeOf(existing);
      this.map.delete(key);
    }
    this.map.set(key, value);
    this.bytes += this.sizeOf(value);
    this.evict(key);
  }

  get size(): number {
    return this.map.size;
  }

  /**
   * Evict oldest entries until we're under the entry and byte caps. `justSet`
   * is the key we just inserted; we never evict it, so a single entry larger
   * than the byte cap (a long image description) is still cached for its first
   * turn rather than being evicted the instant it's inserted and re-billed
   * every turn — the cap is a guardrail, not an exact budget.
   */
  private evict(justSet?: K): void {
    while (this.map.size > this.maxEntries || this.bytes > this.maxBytes) {
      const oldest = this.map.keys().next();
      if (oldest.done) {
        break;
      }
      const key = oldest.value;
      if (key === justSet) {
        // The only over-budget entry is the one we just added; keep it.
        break;
      }
      const value = this.map.get(key) as V;
      this.bytes -= this.sizeOf(value);
      this.map.delete(key);
    }
    if (this.bytes < 0) {
      this.bytes = 0;
    }
  }
}

// Cross-request cache: the same image recurs in conversation history across
// turns, so keep its description to avoid re-billing the vision model each time.
// Bounded so a long session of distinct images can't grow the daemon's heap
// without limit: evict the least-recently-used entry once we exceed either the
// entry cap or the (approximate) byte cap. Byte size is approximated by the
// description string length — ASCII-dominant text, so length ≈ bytes; the cap is
// a guardrail, not an exact budget.
const IMAGE_CACHE_MAX_ENTRIES = 64;
const IMAGE_CACHE_MAX_BYTES = 4 * 1024 * 1024;
const imageDescriptionCache = new LruCache<string, string>(
  IMAGE_CACHE_MAX_ENTRIES,
  IMAGE_CACHE_MAX_BYTES,
);

/**
 * Find every image/url block in the request, describe it with the vision model,
 * and replace it in place with a `text` block holding the description. GLM-5.2
 * is text-only, so this is what lets Claude Code's images reach the model.
 */
export async function resolveImageBlocks(
  body: AnthropicMessagesRequest,
  options: ClaudeVisionOptions,
): Promise<void> {
  const descriptions = new Map<string, string>();

  const resolve = async (block: AnthropicContentBlock): Promise<AnthropicContentBlock> => {
    if (!isImageBlock(block) && !isUrlImageBlock(block)) {
      return block;
    }
    const key = imageBlockKey(block);
    let cached = descriptions.get(key) ?? imageDescriptionCache.get(key);
    if (cached === undefined) {
      debugLog(options, "vision describe start", { key });
      const result = await describeImage(block as ImageBlock | UrlBlock, {
        apiKey: options.apiKey,
        baseUrl: options.baseUrl,
        debug: options.debug,
      });
      debugLog(options, "vision describe done", {
        key,
        model: result.model,
        length: result.description.length,
        preview: result.description.slice(0, 200),
      });
      if (result.usage) {
        options.costTracker?.addVisionUsage(
          result.model,
          result.usage.promptTokens,
          result.usage.completionTokens,
        );
      }
      cached = `${result.description}\n[described by ${result.model}]`;
      imageDescriptionCache.set(key, cached);
    }
    descriptions.set(key, cached);
    return { type: "text", text: `[Image description]\n${cached}` };
  };

  // Replace image blocks inside the system content array.
  if (Array.isArray(body.system)) {
    body.system = await Promise.all(body.system.map((block) => resolve(block)));
  }

  // Replace image blocks inside each message's content array.
  for (const message of body.messages ?? []) {
    if (Array.isArray(message.content)) {
      message.content = await Promise.all(
        message.content.map(async (block) => {
          const resolved = await resolve(block);
          if (resolved.type === "tool_result" && Array.isArray(resolved.content)) {
            resolved.content = await Promise.all(
              resolved.content.map(async (innerBlock) => {
                return typeof innerBlock === "object" && innerBlock !== null
                  ? await resolve(innerBlock as AnthropicContentBlock)
                  : innerBlock;
              }),
            );
          }
          return resolved;
        }),
      );
    }
  }
}

/**
 * Walks the request for image-like content blocks and returns a debug-friendly
 * summary (base64/url data truncated). Used to learn the exact shape Claude
 * Code sends when a user attaches a photo or screenshot, so the proxy can
 * intercept and route images to a vision-capable Together model.
 */
export function extractImageBlocks(body: AnthropicMessagesRequest): Array<Record<string, unknown>> {
  const found: Array<Record<string, unknown>> = [];
  const knownTypes = new Set([
    "text",
    "thinking",
    "redacted_thinking",
    "tool_use",
    "server_tool_use",
    "tool_result",
    "web_search_tool_result",
    "web_search_tool_result_error",
  ]);

  const inspectBlock = (block: unknown, location: string): void => {
    if (typeof block !== "object" || block === null) {
      return;
    }
    const record = block as Record<string, unknown>;
    const type = record.type;
    const isImageLike =
      type === "image" ||
      type === "url" ||
      type === "document" ||
      (typeof type === "string" && !knownTypes.has(type));
    if (!isImageLike) {
      return;
    }
    const summary: Record<string, unknown> = { location, type, rawKeys: Object.keys(record) };
    const source = record.source as Record<string, unknown> | undefined;
    if (source) {
      summary.sourceType = source.type;
      summary.mediaType = source.media_type;
      const data = source.data;
      summary.dataPreview =
        typeof data === "string" ? `${data.slice(0, 32)}… (${data.length} chars)` : typeof data;
    }
    const url = record.url;
    if (typeof url === "string") {
      summary.urlPreview = url.length > 64 ? `${url.slice(0, 64)}…` : url;
    }
    found.push(summary);
  };

  const inspectContent = (content: unknown, location: string): void => {
    if (!Array.isArray(content)) {
      return;
    }
    for (const block of content) {
      inspectBlock(block, location);
      // tool_result content can itself be an array of blocks (e.g. an image
      // returned by a tool), so recurse one level.
      const inner = (block as Record<string, unknown> | null)?.content;
      if (Array.isArray(inner)) {
        for (const innerBlock of inner) {
          inspectBlock(innerBlock, `${location}/tool_result`);
        }
      }
    }
  };

  inspectContent(body.system, "system");
  for (const message of body.messages ?? []) {
    inspectContent(message.content, `messages[${message.role}]`);
  }
  return found;
}

function debugLog(
  options: ClaudeVisionOptions,
  label: string,
  value: unknown | (() => unknown),
): void {
  writeProxyDebugLog("togetherlink proxy", options, label, value);
}
