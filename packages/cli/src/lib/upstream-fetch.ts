import { Agent } from "undici";

type FetchInitWithDispatcher = RequestInit & {
  dispatcher: unknown;
};

const upstreamDispatcher = new Agent({
  connections: readPositiveIntegerEnv("TOGETHERLINK_UPSTREAM_CONNECTIONS", 32),
  pipelining: readPositiveIntegerEnv("TOGETHERLINK_UPSTREAM_PIPELINING", 1),
  keepAliveTimeout: readPositiveIntegerEnv("TOGETHERLINK_UPSTREAM_KEEPALIVE_MS", 10_000),
  keepAliveMaxTimeout: readPositiveIntegerEnv("TOGETHERLINK_UPSTREAM_KEEPALIVE_MAX_MS", 60_000),
});

export function upstreamFetch(
  input: Parameters<typeof fetch>[0],
  init: RequestInit = {},
): Promise<Response> {
  const tunedInit = {
    ...init,
    dispatcher: upstreamDispatcher,
  } as unknown as FetchInitWithDispatcher;
  return fetch(input, tunedInit as unknown as RequestInit);
}

function readPositiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
