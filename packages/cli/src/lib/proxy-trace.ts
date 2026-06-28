export type ProxyTraceEvent = {
  id: string;
  route: string;
  method: string;
  model?: string;
  requestedModel?: string;
  targetModel?: string;
  stream?: boolean;
  upstreamMode?: "buffered" | "stream";
  requestBytes?: number;
  requestPreview?: string;
  cacheKey?: {
    systemHash?: string;
    toolsHash?: string;
    messagesHash?: string;
    fullHash?: string;
  };
  promptProfile?: {
    stablePrefixBytes: number;
    dynamicBytes: number;
    totalBytes: number;
    systemBytes: number;
    toolsBytes: number;
    messagesBytes: number;
  };
  messageCount?: number;
  toolCount?: number;
  nativeToolCount?: number;
  startedAt: number;
  upstreamStartedAt?: number;
  upstreamHeadersAt?: number;
  firstByteAt?: number;
  durationMs?: number;
  completedAt?: number;
  ok?: boolean;
  status?: number;
  error?: string;
  usage?: {
    promptTokens: number;
    cachedTokens: number;
    completionTokens: number;
    costUsd: number;
  };
};

export function redactTraceError(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/gi, "Bearer [redacted]")
    .replace(/tgp_[A-Za-z0-9_-]+/g, "[redacted-api-key]")
    .slice(0, 1000);
}
