import { createConnection } from "node:net";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { cleanupTmpDir, createTestContext } from "./context.js";
import { startTestDaemon, type TestDaemon } from "./daemon-session.js";
import type { TestContext } from "./types.js";

describe("daemon Responses WebSocket fallback", () => {
  let context: TestContext;
  let daemon: TestDaemon;

  beforeAll(async () => {
    context = await createTestContext();
    daemon = await startTestDaemon(context);
  }, 30_000);

  afterAll(async () => {
    await daemon?.stop();
    await cleanupTmpDir(context);
  });

  test("declines a WebSocket upgrade with HTTP 426 so Codex falls back to SSE", async () => {
    const response = await requestWebSocketUpgrade(daemon.url);

    expect(response).toMatch(/^HTTP\/1\.1 426 Upgrade Required\r\n/);
    expect(response).toContain("Connection: close\r\n");
    expect(response).toContain("Content-Length: 0\r\n");
  });
});

async function requestWebSocketUpgrade(url: string): Promise<string> {
  const target = new URL(url);
  const chunks: Buffer[] = [];

  return await new Promise<string>((resolve, reject) => {
    const socket = createConnection({
      host: target.hostname,
      port: Number(target.port),
    });
    let settled = false;
    const settle = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.destroy();
      if (error && chunks.length === 0) {
        reject(error);
        return;
      }
      resolve(Buffer.concat(chunks).toString("utf8"));
    };
    const timeout = setTimeout(
      () => settle(new Error("daemon did not answer the WebSocket upgrade within 2 seconds")),
      2_000,
    );

    socket.once("connect", () => {
      socket.write(
        [
          "GET /session/test/v1/responses HTTP/1.1",
          `Host: ${target.host}`,
          "Connection: Upgrade",
          "Upgrade: websocket",
          "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==",
          "Sec-WebSocket-Version: 13",
          "",
          "",
        ].join("\r\n"),
      );
    });
    socket.on("data", (chunk: Buffer) => chunks.push(chunk));
    socket.once("end", () => settle());
    socket.once("close", () => settle());
    socket.once("error", (error) => settle(error));
  });
}
