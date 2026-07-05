import { type IncomingMessage, type ServerResponse } from "node:http";
import { CLAUDE_SUPPORTED_MODELS } from "./defaults.js";
import { type ModelDefinition } from "@togetherlink/models";
import { CostTracker } from "../cost.js";
import { createProxyPerfTracer, type ProxyPerfSink } from "../proxy-perf.js";
import { writeProxyDebugLog } from "../proxy-debug.js";
import { isAuthorized, readJsonBodyWithSize, requestPath, writeJson } from "../http-util.js";
import { objectKeys } from "./content-format.js";
import { nativeServerTools } from "./translate-request.js";
import {
  claudeModelResponse,
  countTokensResponse,
  findClaudeModel,
  toAnthropicMessage,
} from "./translate-response.js";
import { writeAnthropicError } from "./together-call.js";
import { streamAnthropicFromTogether } from "./stream.js";
import { extractImageBlocks, resolveImageBlocks } from "./vision-resolver.js";
import { callTogetherChatCompletions } from "./chat-completions.js";

import type {
  AnthropicCountTokensRequest,
  AnthropicMessage,
  AnthropicMessagesRequest,
  AnthropicTool,
} from "./wire-types.js";

export type ClaudeProxyOptions = {
  apiKey: string;
  /** Claude-facing model alias, e.g. together-glm-5-2. */
  modelId: string;
  /** Together API model id, e.g. zai-org/GLM-5.2. */
  targetModelId: string;
  modelName: string;
  modelDefinition: ModelDefinition;
  authToken: string;
  debug?: boolean | undefined;
  costTracker?: CostTracker | undefined;
  perfSink?: ProxyPerfSink | undefined;
};

/**
 * Handle one claude-facing `/v1/*` (or health/models) request against a single
 * session's options. The shared daemon resolves the session from the request's
 * Bearer/x-api-key token, then calls this with that session's `options`. There
 * is no in-process per-session server anymore — the daemon owns the single
 * `http.Server` (see daemon/server.ts), so this handler is the only proxy
 * entrypoint.
 */
export async function handleProxyRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: ClaudeProxyOptions,
): Promise<void> {
  const path = requestPath(req);
  const perf = createProxyPerfTracer(
    "claude.proxy",
    {
      method: req.method,
      path,
    },
    options.perfSink,
  );
  debugLog(options, "http request", { method: req.method, url: req.url, path });

  if (req.method === "HEAD" && path === "/") {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === "GET" && path === "/healthz") {
    writeJson(res, 200, { ok: true });
    return;
  }

  if (!isAuthorized(req, options.authToken)) {
    writeAnthropicError(res, 401, "authentication_error", "Unauthorized local proxy request.");
    return;
  }

  if (req.method === "GET" && path === "/v1/models") {
    // Claude Code's model discovery (CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY)
    // reads `max_input_tokens` as the context window and `max_tokens` as the
    // output cap per model object (since Mar 2026 — there is no `context_window`
    // field). Without these, Claude Code falls back to a ~200K default and
    // auto-compacts earlier than the selected model's true window, and the
    // context indicator shows the wrong "% used". Advertise the real limits so
    // compaction triggers at the right point.
    writeJson(res, 200, {
      data: CLAUDE_SUPPORTED_MODELS.map(claudeModelResponse),
    });
    return;
  }

  if (req.method === "GET" && path.startsWith("/v1/models/")) {
    const modelId = decodeURIComponent(path.slice("/v1/models/".length));
    const model = findClaudeModel(modelId, options);
    if (!model) {
      writeAnthropicError(res, 404, "not_found_error", `Unknown model "${modelId}".`);
      return;
    }
    writeJson(res, 200, claudeModelResponse(model));
    return;
  }

  if (req.method === "POST" && path === "/v1/messages/count_tokens") {
    const { body: parsedBody, rawBytes } = await readJsonBodyWithSize(req);
    const body = parsedBody as Partial<AnthropicCountTokensRequest>;
    if (!body || typeof body !== "object") {
      writeAnthropicError(res, 400, "invalid_request_error", "Request body must be an object.");
      return;
    }
    if (!body.model) {
      writeAnthropicError(res, 400, "invalid_request_error", "model is required.");
      return;
    }
    if (!Array.isArray(body.messages)) {
      writeAnthropicError(res, 400, "invalid_request_error", "messages must be an array.");
      return;
    }
    writeJson(
      res,
      200,
      countTokensResponse(
        body as AnthropicCountTokensRequest,
        options,
        rawBytes,
        options.costTracker?.tokenEstimator,
      ),
    );
    return;
  }

  if (req.method !== "POST" || path !== "/v1/messages") {
    writeAnthropicError(
      res,
      404,
      "not_found_error",
      `Unsupported route ${req.method ?? ""} ${req.url ?? ""}`.trim(),
    );
    return;
  }

  // readJsonBodyWithSize captures the raw inbound byte length — the cheap
  // signal the self-calibrating token estimator keys on (see cost.ts).
  const { body: parsedBody, rawBytes } = await perf.span("body_read_parse", () =>
    readJsonBodyWithSize(req),
  );
  const body = parsedBody as AnthropicMessagesRequest;
  const upstreamAbort = new AbortController();
  const markClientDisconnected = () => {
    upstreamAbort.abort();
  };
  req.once("aborted", markClientDisconnected);
  res.once("close", () => {
    if (!res.writableEnded) {
      markClientDisconnected();
    }
  });
  // Record the inbound byte length for the estimator, then mark a new request
  // (beginRequest resets the per-request delta and arms the first-addUsage
  // calibration). noteRequestBytes must precede beginRequest's first addUsage.
  options.costTracker?.noteRequestBytes(rawBytes);
  options.costTracker?.beginRequest();
  debugLog(options, "anthropic request", () => ({
    model: body.model,
    stream: body.stream,
    messageCount: body.messages?.length ?? 0,
    toolCount: body.tools?.length ?? 0,
    tools: summarizeAnthropicTools(body.tools),
  }));
  const imageBlocks = extractImageBlocks(body);
  if (imageBlocks.length > 0) {
    debugLog(options, "image blocks detected", imageBlocks);
  }
  // GLM-5.2 can't see images: describe each image/url block with a vision model
  // and replace it with a text block, so GLM reasons over the description.
  if (imageBlocks.length > 0) {
    await perf.span("vision_image_resolution", () => resolveImageBlocks(body, options), {
      imageBlockCount: imageBlocks.length,
    });
  } else {
    perf.mark("vision_image_resolution_skipped", { imageBlockCount: 0 });
  }
  if (body.stream) {
    await perf.span(
      "stream_response",
      () =>
        streamAnthropicFromTogether(
          res,
          body,
          { ...options, rawBytes },
          upstreamAbort.signal,
          perf,
        ),
      { nativeToolCount: nativeServerTools(body.tools).length },
    );
    const delta = options.costTracker?.requestDelta;
    const totals = options.costTracker?.totals;
    if (options.debug && delta && totals) {
      debugLog(options, "request cost", {
        requestCostUsd: Number(delta.costUsd.toFixed(6)),
        requestInputTokens: delta.promptTokens,
        requestCachedTokens: delta.cachedTokens,
        requestOutputTokens: delta.completionTokens,
        sessionTotalCostUsd: Number(totals.costUsd.toFixed(6)),
      });
    }
    perf.end({ status: res.statusCode, stream: true });
    return;
  }

  const openAiResponse = await callTogetherChatCompletions(
    body,
    { ...options, rawBytes },
    upstreamAbort.signal,
    perf,
  );
  const anthropicMessage = perf.spanSync("response_map", () =>
    toAnthropicMessage(openAiResponse, body.model ?? options.modelId),
  );

  const delta = options.costTracker?.requestDelta;
  const totals = options.costTracker?.totals;
  if (options.debug && delta && totals) {
    debugLog(options, "request cost", {
      requestCostUsd: Number(delta.costUsd.toFixed(6)),
      requestInputTokens: delta.promptTokens,
      requestCachedTokens: delta.cachedTokens,
      requestOutputTokens: delta.completionTokens,
      sessionTotalCostUsd: Number(totals.costUsd.toFixed(6)),
    });
  }

  writeJson(res, 200, anthropicMessage);
  perf.end({ status: res.statusCode, stream: false });
}

function debugLog(
  options: ClaudeProxyOptions,
  label: string,
  value: unknown | (() => unknown),
): void {
  writeProxyDebugLog("togetherlink proxy", options, label, value);
}

function summarizeAnthropicTools(
  tools: AnthropicTool[] | undefined,
): Array<Record<string, unknown>> | undefined {
  if (!tools || tools.length === 0) {
    return undefined;
  }
  return tools.map((tool) => ({
    name: tool.name,
    type: tool.type,
    maxUses: tool.max_uses,
    inputSchemaKeys: objectKeys(tool.input_schema),
    rawKeys: Object.keys(tool),
  }));
}
