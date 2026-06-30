import { performance } from "node:perf_hooks";

type ProxyPerfFields = Record<string, unknown>;

type ProxyPerfSpan = {
  name: string;
  durationMs: number;
  atMs: number;
  fields?: ProxyPerfFields;
};

type ProxyPerfMark = {
  name: string;
  atMs: number;
  fields?: ProxyPerfFields;
};

export type ProxyPerfTracer = {
  readonly enabled: boolean;
  span<T>(name: string, fn: () => Promise<T>, fields?: ProxyPerfFields): Promise<T>;
  spanSync<T>(name: string, fn: () => T, fields?: ProxyPerfFields): T;
  mark(name: string, fields?: ProxyPerfFields): void;
  markOnce(name: string, fields?: ProxyPerfFields): void;
  end(fields?: ProxyPerfFields): void;
};

export function createProxyPerfTracer(name: string, fields: ProxyPerfFields = {}): ProxyPerfTracer {
  if (process.env.TOGETHERLINK_PERF !== "1") {
    return disabledProxyPerfTracer;
  }
  const startedAt = performance.now();
  const spans: ProxyPerfSpan[] = [];
  const marks: ProxyPerfMark[] = [];
  const seenMarks = new Set<string>();
  let ended = false;

  const elapsed = () => performance.now() - startedAt;
  const recordSpan = (spanName: string, start: number, spanFields?: ProxyPerfFields) => {
    spans.push({
      name: spanName,
      durationMs: roundMs(performance.now() - start),
      atMs: roundMs(elapsed()),
      ...(spanFields ? { fields: spanFields } : {}),
    });
  };

  return {
    enabled: true,
    async span<T>(
      spanName: string,
      fn: () => Promise<T>,
      spanFields?: ProxyPerfFields,
    ): Promise<T> {
      const start = performance.now();
      try {
        return await fn();
      } finally {
        recordSpan(spanName, start, spanFields);
      }
    },
    spanSync<T>(spanName: string, fn: () => T, spanFields?: ProxyPerfFields): T {
      const start = performance.now();
      try {
        return fn();
      } finally {
        recordSpan(spanName, start, spanFields);
      }
    },
    mark(markName: string, markFields?: ProxyPerfFields): void {
      marks.push({
        name: markName,
        atMs: roundMs(elapsed()),
        ...(markFields ? { fields: markFields } : {}),
      });
    },
    markOnce(markName: string, markFields?: ProxyPerfFields): void {
      if (seenMarks.has(markName)) {
        return;
      }
      seenMarks.add(markName);
      this.mark(markName, markFields);
    },
    end(endFields?: ProxyPerfFields): void {
      if (ended) {
        return;
      }
      ended = true;
      const payload = {
        name,
        totalMs: roundMs(elapsed()),
        fields,
        ...(endFields ? { result: endFields } : {}),
        spans,
        marks,
      };
      process.stderr.write(`[togetherlink perf] ${JSON.stringify(payload)}\n`);
    },
  };
}

const disabledProxyPerfTracer: ProxyPerfTracer = {
  enabled: false,
  async span<T>(_name: string, fn: () => Promise<T>): Promise<T> {
    return await fn();
  },
  spanSync<T>(_name: string, fn: () => T): T {
    return fn();
  },
  mark(): void {},
  markOnce(): void {},
  end(): void {},
};

function roundMs(value: number): number {
  return Math.round(value * 1000) / 1000;
}
