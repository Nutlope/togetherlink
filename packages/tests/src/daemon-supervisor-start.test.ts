import { afterEach, describe, expect, test, vi } from "vitest";
import http from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const supervisor = vi.hoisted(() => ({
  status: vi.fn(),
  start: vi.fn(),
  install: vi.fn(),
  runningFromBundle: vi.fn(),
}));

vi.mock("../../cli/src/lib/daemon/platform-auto-start.js", () => ({
  autoStartStatus: supervisor.status,
  startAutoStart: supervisor.start,
  installAutoStart: supervisor.install,
}));

vi.mock("../../cli/src/lib/daemon/detect-bundle.js", () => ({
  runningFromBundle: supervisor.runningFromBundle,
}));

import { ensureDaemon } from "../../cli/src/lib/daemon/launch.js";

describe("installed daemon startup", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  test("starts the installed OS supervisor instead of spawning a detached daemon", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "togetherlink-supervisor-test-"));
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (typeof address !== "object" || address === null) {
      throw new Error("test server did not bind");
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));

    vi.stubEnv("TOGETHERLINK_HOME", home);
    vi.stubEnv("TOGETHERLINK_PORT", String(address.port));
    supervisor.runningFromBundle.mockResolvedValue(true);
    supervisor.status.mockResolvedValue({ installed: true, loaded: false, message: "installed" });
    supervisor.start.mockImplementation(async () => {
      await new Promise<void>((resolve) => server.listen(address.port, "127.0.0.1", resolve));
      return true;
    });

    try {
      await expect(ensureDaemon()).resolves.toEqual({
        url: `http://127.0.0.1:${address.port}`,
      });
      expect(supervisor.start).toHaveBeenCalledOnce();
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(home, { recursive: true, force: true });
    }
  }, 10_000);

  test("repairs an installed supervisor that starts but never becomes healthy", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "togetherlink-supervisor-repair-test-"));
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (typeof address !== "object" || address === null) {
      throw new Error("test server did not bind");
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));

    vi.stubEnv("TOGETHERLINK_HOME", home);
    vi.stubEnv("TOGETHERLINK_PORT", String(address.port));
    supervisor.runningFromBundle.mockResolvedValue(true);
    supervisor.status.mockResolvedValue({ installed: true, loaded: false, message: "installed" });
    supervisor.start.mockResolvedValue(true);
    supervisor.install.mockImplementation(async () => {
      await new Promise<void>((resolve) => server.listen(address.port, "127.0.0.1", resolve));
      return { installed: true, message: "repaired" };
    });

    try {
      await expect(ensureDaemon({ healthPollTimeoutMs: 100 })).resolves.toEqual({
        url: `http://127.0.0.1:${address.port}`,
      });
      expect(supervisor.start).toHaveBeenCalledOnce();
      expect(supervisor.install).toHaveBeenCalledOnce();
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(home, { recursive: true, force: true });
    }
  });

  test("reports supervisor recovery commands instead of suggesting a different port", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "togetherlink-supervisor-error-test-"));
    const server = http.createServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (typeof address !== "object" || address === null) {
      throw new Error("test server did not bind");
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));

    vi.stubEnv("TOGETHERLINK_HOME", home);
    vi.stubEnv("TOGETHERLINK_PORT", String(address.port));
    supervisor.runningFromBundle.mockResolvedValue(true);
    supervisor.status.mockResolvedValue({ installed: true, loaded: false, message: "installed" });
    supervisor.start.mockResolvedValue(true);
    supervisor.install.mockRejectedValue(new Error("service failed"));

    try {
      await expect(ensureDaemon({ healthPollTimeoutMs: 100 })).rejects.toThrow(
        new RegExp(
          `togetherlink daemon install.*togetherlink daemon status.*${home.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/logs/daemon\\.log`,
          "s",
        ),
      );
      await expect(ensureDaemon({ healthPollTimeoutMs: 100 })).rejects.not.toThrow(
        /TOGETHERLINK_PORT/,
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
