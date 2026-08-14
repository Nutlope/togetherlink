import { afterAll, beforeAll, describe, expect, test } from "vitest";
import http from "node:http";
import { cleanupTmpDir, createTestContext } from "./context.js";
import { startTestDaemon } from "./daemon-session.js";
import type { TestContext } from "./types.js";

describe("daemon graceful shutdown", () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestContext();
  });

  afterAll(async () => {
    await cleanupTmpDir(context);
  });

  test("lets an in-flight HTTP request finish before exiting on SIGTERM", async () => {
    const daemon = await startTestDaemon(context);
    const request = http.request(`${daemon.url}/internal/sessions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": "2",
      },
    });
    const responseStatus = new Promise<number | undefined>((resolve, reject) => {
      request.once("response", (response) => {
        response.resume();
        response.once("end", () => resolve(response.statusCode));
      });
      request.once("error", reject);
    });
    await new Promise<void>((resolve, reject) => {
      request.once("socket", (socket) => {
        if (socket.readyState === "open") {
          resolve();
          return;
        }
        socket.once("connect", resolve);
        socket.once("error", reject);
      });
    });

    // Send only half of the declared body so the request stays active while
    // launchd asks the daemon to restart.
    request.write("{");
    await new Promise((resolve) => setTimeout(resolve, 25));
    daemon.signal("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      expect(daemon.isRunning()).toBe(true);
      request.end("}");
      expect(await responseStatus).toBe(400);
      await daemon.waitForExit();
      expect(daemon.isRunning()).toBe(false);
    } finally {
      request.destroy();
      await daemon.stop();
    }
  });
});
