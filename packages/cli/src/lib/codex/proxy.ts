import { type IncomingMessage, type ServerResponse } from "node:http";
import { findModelById, type ModelDefinition } from "@togetherlink/models";
import { codexModelCatalog } from "./catalog.js";
import type { CostTracker } from "../cost.js";
import { createProxyPerfTracer, type ProxyPerfSink } from "../proxy-perf.js";
import { requestPath, writeJson } from "../http-util.js";
import { writeProxyDebugLog } from "../proxy-debug.js";
import { objectKeys } from "./content-format.js";
import {
  compactionInput,
  compactionSummary,
  isTogetherCompactionV2,
  normalizeNativeCompactionInput,
  togetherCompactionResponse,
  togetherV1CompactOutput,
  toTogetherCompactionPayload,
  writeTogetherCompactionSse,
} from "./compaction.js";
import { forwardNativeCodexRequest, readDecodedCodexRequest } from "./native-router.js";
import { sanitizeNativeResponsesReplay } from "./native-replay.js";
import {
  invalidMemoryTraces,
  summarizeTogetherMemories,
  type CodexMemoriesRequest,
} from "./memories.js";
import {
  codexHistoricalImageReferences,
  resolveCodexRequestModel,
  toChatPayload,
  translateCodexRequestTools,
} from "./translate-request.js";
import { toResponsesResponse } from "./translate-response.js";
import { callTogetherWithNativeTools } from "./together-call.js";
import { recordUsage } from "./usage.js";
import { streamResponseFromTogether } from "./stream.js";
import {
  CODEX_COMPACTION_PATH,
  CODEX_MEMORIES_PATH,
  isCodexNativeOnlyPath,
  isCodexResponsesPath,
  normalizeCodexPath,
} from "./routes.js";
import type { ResponsesRequest, ResponsesTool } from "./wire-types.js";
import type { TogetherClientOptions } from "../together-client.js";
import { effectiveReasoningHistoryMode, type ReasoningHistoryMode } from "../reasoning-history.js";

export type CodexProxyOptions = {
  apiKey: string;
  /** Session-scoped Together API root resolved by the launching process. */
  baseUrl: string;
  modelId: string;
  targetModelId: string;
  modelName: string;
  modelDefinition: ModelDefinition;
  authToken: string;
  /** Historical model reasoning replay policy. Defaults to full for old sessions. */
  reasoningHistoryMode?: ReasoningHistoryMode | undefined;
  /** When set, unknown/non-Together model ids retain normal ChatGPT routing. */
  nativeBaseUrl?: string | undefined;
  debug?: boolean | undefined;
  costTracker?: CostTracker | undefined;
  perfSink?: ProxyPerfSink | undefined;
  fetch?: TogetherClientOptions["fetch"];
  /** Include the virtual Auto row while this session is backed by a hosted router. */
  includeAutoModel?: boolean | undefined;
  /** Search evidence retained inside the proxy so client-visible
   * `web_search_call` items never need to masquerade as assistant text. */
  nativeSearchResults?: Map<string, string> | undefined;
};

export async function handleCodexProxyRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: CodexProxyOptions,
): Promise<void> {
  options.nativeSearchResults ??= new Map<string, string>();
  const requestedPath = requestPath(req);
  const path = normalizeCodexPath(requestedPath);
  const perf = createProxyPerfTracer(
    "codex.proxy",
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

  if (req.method === "GET" && path === "/v1/models") {
    writeJson(res, 200, codexModelCatalog({ includeAuto: Boolean(options.includeAutoModel) }));
    return;
  }

  const nativeOnlyPath = isCodexNativeOnlyPath(path);
  const memoriesPath = path === CODEX_MEMORIES_PATH;
  const responsesPath = isCodexResponsesPath(path);
  if (
    req.method === "POST" &&
    (nativeOnlyPath || memoriesPath || responsesPath) &&
    !requireCodexTransport(req, res)
  ) {
    return;
  }
  if (req.method === "POST" && nativeOnlyPath && options.nativeBaseUrl) {
    const request = await readDecodedCodexRequest(req);
    await forwardNativeCodexRequest(req, res, {
      baseUrl: options.nativeBaseUrl,
      path,
      body: request.bytes,
      ...(options.fetch ? { fetch: options.fetch } : {}),
    });
    perf.end({ status: res.statusCode, native: true });
    return;
  }

  if (req.method === "POST" && memoriesPath) {
    const request = await perf.span("body_read_parse", () => readDecodedCodexRequest(req));
    const body = request.body as CodexMemoriesRequest;
    const requestedTogetherModel = body.model ? findModelById(body.model) : options.modelDefinition;
    if (options.nativeBaseUrl && body.model && !requestedTogetherModel) {
      await forwardNativeCodexRequest(req, res, {
        baseUrl: options.nativeBaseUrl,
        path,
        body: request.bytes,
        ...(options.fetch ? { fetch: options.fetch } : {}),
      });
      perf.end({ status: res.statusCode, native: true, model: body.model });
      return;
    }
    const invalidTraces = invalidMemoryTraces(body.traces);
    if (invalidTraces) {
      writeOpenAIError(res, 400, "invalid_request_error", invalidTraces);
      perf.end({ status: res.statusCode });
      return;
    }
    options.costTracker?.beginRequest();
    const definition = requestedTogetherModel ?? options.modelDefinition;
    const targetModelId = requestedTogetherModel?.id ?? options.targetModelId;
    const upstreamAbort = new AbortController();
    const abort = () =>
      upstreamAbort.abort(new DOMException("Codex client disconnected.", "AbortError"));
    req.once("aborted", abort);
    res.once("close", () => {
      if (!res.writableEnded) abort();
    });
    const summarized = await summarizeTogetherMemories(
      body,
      targetModelId,
      definition,
      options,
      upstreamAbort.signal,
      (usage) => recordUsage(usage, options, definition),
    );
    writeJson(res, 200, { output: summarized.output });
    perf.end({ status: res.statusCode, traces: body.traces.length, model: targetModelId });
    return;
  }

  if (req.method !== "POST" || !responsesPath) {
    writeOpenAIError(
      res,
      404,
      "not_found_error",
      `Unsupported route ${req.method ?? ""} ${req.url ?? ""}`.trim(),
    );
    return;
  }

  // Decode the Responses body before resolving native versus Together routing.
  // Built-in OpenAI traffic may arrive zstd-compressed.
  const request = await perf.span("body_read_parse", () => readDecodedCodexRequest(req));
  const { body } = request;
  const requestedTogetherModel = body.model ? findModelById(body.model) : undefined;
  if (options.nativeBaseUrl && body.model && !requestedTogetherModel) {
    const nativeBody = sanitizeNativeResponsesReplay({ ...body }) as ResponsesRequest &
      Record<string, unknown> & { previous_response_id?: unknown };
    if (nativeBody.input !== undefined) {
      nativeBody.input = normalizeNativeCompactionInput(nativeBody.input);
    }
    if (path !== CODEX_COMPACTION_PATH) {
      delete nativeBody.previous_response_id;
    }
    await forwardNativeCodexRequest(req, res, {
      baseUrl: options.nativeBaseUrl,
      path,
      body: Buffer.from(JSON.stringify(nativeBody), "utf8"),
      ...(options.fetch ? { fetch: options.fetch } : {}),
    });
    perf.end({ status: res.statusCode, native: true, model: body.model });
    return;
  }
  const inputEstimate = codexInputEstimate(body, request.rawBytes);
  // Together reports one combined prompt-token total for text and vision. Do
  // not use image-bearing turns to calibrate the text bytes/token ratio: a
  // multi-megabyte PNG data URL is transport encoding, not model text.
  options.costTracker?.noteRequestBytes(inputEstimate.hasImages ? 0 : request.rawBytes);
  options.costTracker?.beginRequest();
  const estimatedBytes = inputEstimate.hasImages ? inputEstimate.textBytes : request.rawBytes;
  const estimatedInputTokens =
    options.costTracker?.tokenEstimator.estimate(estimatedBytes) ??
    Math.max(1, Math.ceil(estimatedBytes / 4));
  const upstreamAbort = new AbortController();
  const markClientDisconnected = () => {
    if (upstreamAbort.signal.aborted) {
      return;
    }
    debugLog(options, "codex client disconnected; aborting upstream request", {});
    upstreamAbort.abort(new DOMException("Codex client disconnected.", "AbortError"));
  };
  req.once("aborted", markClientDisconnected);
  res.once("close", () => {
    if (!res.writableEnded) {
      markClientDisconnected();
    }
  });
  const translated = perf.spanSync("translate_request", () => {
    const toolTranslation = translateCodexRequestTools(body);
    const nativeToolCount = toolTranslation.nativeTools.length;
    const requestModel = resolveCodexRequestModel(body, options);
    const translatedPayload = toChatPayload(
      body,
      options,
      Boolean(body.stream),
      toolTranslation,
      requestModel,
      estimatedInputTokens,
    );
    return { nativeToolCount, toolTranslation, requestModel, translatedPayload };
  });
  const { nativeToolCount, toolTranslation, requestModel, translatedPayload } = translated;

  const compactV1 = path === CODEX_COMPACTION_PATH;
  const compactV2 = isTogetherCompactionV2(body);
  if (compactV1 || compactV2) {
    const compactBody: ResponsesRequest = structuredClone(body);
    delete (compactBody as { tools?: unknown }).tools;
    const normalizedInput = compactionInput(body);
    if (normalizedInput !== undefined) {
      compactBody.input = normalizedInput;
    }
    const compactPayload = toTogetherCompactionPayload(
      toChatPayload(
        compactBody,
        options,
        false,
        { tools: [], mappings: new Map(), nativeTools: [] },
        requestModel,
        estimatedInputTokens,
      ),
      requestModel.definition,
    );
    const historicalImageReferences = codexHistoricalImageReferences(compactBody.input);
    const { response: chatResponse } = await perf.span("compaction_upstream_fetch", () =>
      callTogetherWithNativeTools(
        compactPayload,
        { tools: [], mappings: new Map(), nativeTools: [] },
        options,
        upstreamAbort.signal,
      ),
    );
    recordUsage(chatResponse.usage, options, requestModel.definition);
    const baseSummary = compactionSummary(chatResponse);
    const summary =
      historicalImageReferences.length > 0
        ? `${baseSummary}\n\nHistorical image references preserved by TogetherLink:\n${historicalImageReferences
            .map((reference) => `- ${reference}`)
            .join("\n")}`
        : baseSummary;
    if (compactV1) {
      writeJson(res, 200, togetherV1CompactOutput(body.input, summary));
    } else if (body.stream) {
      writeTogetherCompactionSse(res, body.model ?? options.modelId, summary);
    } else {
      writeJson(res, 200, togetherCompactionResponse(body.model ?? options.modelId, summary));
    }
    perf.end({
      status: res.statusCode,
      compaction: compactV1 ? "v1" : "v2",
      stream: compactV2 && Boolean(body.stream),
    });
    return;
  }
  debugLog(options, "responses request", () => ({
    model: body.model,
    targetModel: requestModel.targetModelId,
    memory: requestModel.memory,
    stream: body.stream,
    inputItems: Array.isArray(body.input) ? body.input.length : typeof body.input,
    toolCount: body.tools?.length ?? 0,
    nativeToolCount,
    reasoningHistoryMode: effectiveReasoningHistoryMode(options.reasoningHistoryMode),
    tools: summarizeResponsesTools(body.tools),
  }));

  if (body.stream) {
    await perf.span(
      "stream_response",
      () =>
        streamResponseFromTogether(
          res,
          body,
          options,
          translatedPayload,
          toolTranslation,
          requestModel.definition,
          upstreamAbort.signal,
          perf,
        ),
      { nativeToolCount },
    );
    perf.end({ status: res.statusCode, stream: true });
    return;
  }

  const nativeToolResponse = await perf.span(
    "upstream_fetch_and_tool_loop",
    () =>
      callTogetherWithNativeTools(
        translatedPayload,
        toolTranslation,
        options,
        upstreamAbort.signal,
      ),
    { nativeToolCount },
  );
  const { response: chatResponse, nativeSearchItems } = nativeToolResponse;
  recordUsage(chatResponse.usage, options, requestModel.definition);
  const responseBody = perf.spanSync("response_map", () =>
    toResponsesResponse(
      chatResponse,
      body,
      {
        ...options,
        ...(typeof translatedPayload.max_tokens === "number"
          ? { requestedMaxTokens: translatedPayload.max_tokens }
          : {}),
      },
      toolTranslation,
      nativeSearchItems,
    ),
  );
  writeJson(res, 200, responseBody);
  perf.end({ status: res.statusCode, stream: false });
}

function codexInputEstimate(
  body: ResponsesRequest,
  rawBytes: number,
): { hasImages: boolean; textBytes: number } {
  let hasImages = false;
  const textOnlyJson = JSON.stringify(body, (_key, value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return value;
    }
    const record = value as Record<string, unknown>;
    if (record.type === "input_image" || record.type === "image_url") {
      hasImages = true;
      return {
        ...record,
        ...(typeof record.image_url === "string" ? { image_url: "[image omitted]" } : {}),
        ...(typeof record.file_id === "string" ? { file_id: "[image file]" } : {}),
      };
    }
    if (record.type === "image_generation_call" && typeof record.result === "string") {
      hasImages = true;
      return { ...record, result: "[generated image omitted]" };
    }
    return value;
  });
  return {
    hasImages,
    textBytes: hasImages ? Buffer.byteLength(textOnlyJson, "utf8") : rawBytes,
  };
}

function requireCodexTransport(req: IncomingMessage, res: ServerResponse): boolean {
  // Do NOT gate on `origin` / `sec-fetch-site`: ChatGPT Desktop is a
  // Chromium/Electron client, so its legitimate fetches carry the same Fetch
  // Metadata headers a browser tab would send. There is no header-based way
  // to tell it apart from a malicious web page; the per-session URL token is
  // the actual auth boundary here. A prior attempt to reject on those headers
  // 403'd every Desktop request, including brand-new chats (see incident
  // 2026-08-01).
  const contentType = String(req.headers["content-type"] ?? "")
    .split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    writeOpenAIError(
      res,
      415,
      "unsupported_media_type",
      "Codex router requests require Content-Type: application/json.",
    );
    return false;
  }
  return true;
}

function summarizeResponsesTools(
  tools: ResponsesTool[] | undefined,
): Array<Record<string, unknown>> | undefined {
  if (!tools || tools.length === 0) {
    return undefined;
  }
  return tools.map((tool) => ({
    name: tool.name,
    type: tool.type,
    parameterKeys: objectKeys(tool.parameters),
    rawKeys: Object.keys(tool),
  }));
}

export function writeOpenAIError(
  res: ServerResponse,
  status: number,
  type: string,
  message: string,
  code?: string,
): void {
  writeJson(res, status, { error: { type, ...(code ? { code } : {}), message } });
}

function debugLog(
  options: CodexProxyOptions,
  label: string,
  payload: unknown | (() => unknown),
): void {
  writeProxyDebugLog("togetherlink codex proxy", options, label, payload);
}
