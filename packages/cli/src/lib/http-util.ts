import { timingSafeEqual } from "node:crypto";
import { type IncomingMessage, type ServerResponse } from "node:http";

export function requestPath(req: IncomingMessage): string {
  return new URL(req.url ?? "/", "http://127.0.0.1").pathname;
}

/**
 * Read the full request body as JSON, returning both the parsed value and the
 * raw byte length of the inbound body. The byte length is the cheap signal the
 * proxy's self-calibrating token estimator keys on (see claude/cost.ts): the
 * Anthropic-JSON size tracks the translated OpenAI-JSON size within a few
 * percent, so it lets us estimate input tokens without serializing the payload
 * a second time.
 */
export async function readJsonBodyWithSize(
  req: IncomingMessage,
): Promise<{ body: unknown; rawBytes: number }> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks);
  const text = raw.toString("utf8");
  const body = text ? JSON.parse(text) : {};
  return { body, rawBytes: raw.length };
}

/**
 * Backwards-compatible thin wrapper around readJsonBodyWithSize that discards
 * the byte length. Existing callers (codex proxy, daemon server) are unaffected.
 */
export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return (await readJsonBodyWithSize(req)).body;
}

export function writeJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(value));
}

/**
 * Pull the presented auth token from a request: the `Bearer` value of the
 * Authorization header, or the `x-api-key` header.
 */
export function extractToken(req: IncomingMessage): string | undefined {
  const authorization = req.headers.authorization;
  if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }
  const apiKey = req.headers["x-api-key"];
  return typeof apiKey === "string" ? apiKey : undefined;
}

export function isAuthorized(req: IncomingMessage, authToken: string): boolean {
  const token = extractToken(req);
  return token !== undefined && constantTimeEqual(token, authToken);
}

function constantTimeEqual(actual: string | undefined, expected: string): boolean {
  if (typeof actual !== "string") {
    return false;
  }
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length) {
    return false;
  }
  return timingSafeEqual(actualBytes, expectedBytes);
}
