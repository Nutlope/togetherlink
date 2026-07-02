/** Parse a Retry-After header (integer seconds or HTTP-date) to milliseconds. */
export function parseRetryAfter(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const seconds = Number.parseInt(value, 10);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }
  const dateMs = Date.parse(value);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }
  return undefined;
}

/** Exponential backoff: 1s, 2s, 4s (for attempts 0,1,2), with deterministic jitter. */
export function backoffMs(attempt: number): number {
  const base = 1000 * 2 ** attempt;
  const jitter = (attempt % 2 === 0 ? 1 : -1) * base * 0.2;
  return Math.max(100, base + jitter);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
