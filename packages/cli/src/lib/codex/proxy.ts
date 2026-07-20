import { type IncomingMessage, type ServerResponse } from "node:http";
import { type ModelDefinition } from "@togetherlink/models";
import { codexModelCatalog } from "./catalog.js";
import type { CostTracker } from "../cost.js";
import { createProxyPerfTracer, type ProxyPerfSink } from "../proxy-perf.js";
import { readJsonBodyWithSize, requestPath, writeJson } from "../http-util.js";
import { writeProxyDebugLog } from "../proxy-debug.js";
import { objectKeys } from "./content-format.js";
import {
  resolveCodexRequestModel,
  toChatPayload,
  translateCodexRequestTools,
} from "./translate-request.js";
import { toResponsesResponse } from "./translate-response.js";
import { callTogetherWithNativeTools } from "./together-call.js";
import { recordUsage } from "./usage.js";
import { streamResponseFromTogether } from "./stream.js";
import type { ResponsesRequest, ResponsesTool } from "./wire-types.js";

export type CodexProxyOptions = {
  apiKey: string;
  /** Session-scoped Together API root resolved by the launching process. */
  baseUrl: string;
  modelId: string;
  targetModelId: string;
  modelName: string;
  modelDefinition: ModelDefinition;
  authToken: string;
  debug?: boolean | undefined;
  costTracker?: CostTracker | undefined;
  perfSink?: ProxyPerfSink | undefined;
};

export async function handleCodexProxyRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: CodexProxyOptions,
): Promise<void> {
  const path = requestPath(req);
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
    writeJson(res, 200, codexModelCatalog());
    return;
  }

  if (req.method !== "POST" || path !== "/v1/responses") {
    writeOpenAIError(
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
  const body = parsedBody as ResponsesRequest;
  // Record the inbound byte length for the estimator, then mark a new request
  // (beginRequest resets the per-request delta and arms the first-addUsage
  // calibration). noteRequestBytes must precede beginRequest's first addUsage.
  options.costTracker?.noteRequestBytes(rawBytes);
  options.costTracker?.beginRequest();
  // Estimate input tokens from the raw byte length via the calibrated estimator
  // (or rawBytes/4 fallback when there is no calibration history). O(1) — this
  // replaces the per-turn full-payload JSON.stringify the old defaultMaxOutputTokens
  // performed. Threading it here lets toChatPayload clamp max_tokens near the
  // window without re-serializing messages + tools.
  const estimatedInputTokens =
    options.costTracker?.tokenEstimator.estimate(rawBytes) ?? Math.ceil(rawBytes / 4);
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
  debugLog(options, "responses request", () => ({
    model: body.model,
    targetModel: requestModel.targetModelId,
    memory: requestModel.memory,
    stream: body.stream,
    inputItems: Array.isArray(body.input) ? body.input.length : typeof body.input,
    toolCount: body.tools?.length ?? 0,
    nativeToolCount,
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

  const chatResponse = await perf.span(
    "upstream_fetch_and_tool_loop",
    () =>
      callTogetherWithNativeTools(
        translatedPayload,
        toolTranslation,
        options,
        requestModel.definition,
        upstreamAbort.signal,
      ),
    { nativeToolCount },
  );
  recordUsage(chatResponse.usage, options, requestModel.definition);
  const responseBody = perf.spanSync("response_map", () =>
    toResponsesResponse(chatResponse, body, options, toolTranslation),
  );
  writeJson(res, 200, responseBody);
  perf.end({ status: res.statusCode, stream: false });
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
): void {
  writeJson(res, status, { error: { type, message } });
}

function debugLog(
  options: CodexProxyOptions,
  label: string,
  payload: unknown | (() => unknown),
): void {
  writeProxyDebugLog("togetherlink codex proxy", options, label, payload);
}
