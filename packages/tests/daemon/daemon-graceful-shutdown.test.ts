import { afterAll, beforeAll, describe, expect, test } from "vitest";
import http from "node:http";
import { cleanupTmpDir, createTestContext } from "../src/context.js";
import { startTestDaemon } from "../src/daemon-session.js";
import type { TestContext } from "../src/types.js";

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

  test("force-closes a stuck request after the shutdown grace period", async () => {
    const daemon = await startTestDaemon(context, { TOGETHERLINK_SHUTDOWN_GRACE_MS: "100" });
    const request = http.request(`${daemon.url}/internal/sessions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": "2",
      },
    });
    request.on("error", () => {});

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
    request.write("{");
    await new Promise((resolve) => setTimeout(resolve, 25));
    daemon.signal("SIGTERM");

    try {
      await Promise.race([
        daemon.waitForExit(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("daemon did not honor shutdown deadline")), 2_000),
        ),
      ]);
      expect(daemon.isRunning()).toBe(false);
    } finally {
      request.destroy();
      await daemon.stop();
    }
  });
});
