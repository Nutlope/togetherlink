import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  autoStartStatus,
  autoStartSupportedPlatform,
  installAutoStart,
  maybeAutoInstallService,
  startAutoStart,
  stopAutoStart,
  uninstallAutoStart,
} from "../../cli/src/lib/daemon/platform-auto-start.js";

describe("portable daemon platforms", () => {
  const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");

  beforeEach(() => {
    Object.defineProperty(process, "platform", { configurable: true, value: "win32" });
  });

  afterEach(() => {
    if (originalPlatform) {
      Object.defineProperty(process, "platform", originalPlatform);
    }
  });

  test("uses portable process mode without invoking Unix supervisors", async () => {
    expect(autoStartSupportedPlatform()).toBe("unsupported");
    await expect(maybeAutoInstallService()).resolves.toBe(false);
    await expect(startAutoStart()).resolves.toBe(false);
    await expect(stopAutoStart()).resolves.toBe(false);
    await expect(autoStartStatus()).resolves.toEqual({
      installed: false,
      message:
        "Auto-start is not available on this platform. TogetherLink will use portable process mode.",
    });
    await expect(installAutoStart()).rejects.toThrow(
      "Auto-start is only supported on macOS and Linux; portable process mode is used elsewhere.",
    );
    await expect(uninstallAutoStart()).rejects.toThrow(
      "Auto-start is only supported on macOS and Linux; portable process mode is used elsewhere.",
    );
  });
});
