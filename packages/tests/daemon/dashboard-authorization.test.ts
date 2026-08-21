import { describe, expect, test } from "vitest";
import {
  signDashboardAuthorization,
  verifyDashboardAuthorization,
} from "../../../site/shared/dashboardAuthorization.js";

const SECRET = "test-only-dashboard-query-secret-with-enough-entropy";
const NOW = 1_800_000_000_000;
const NONCE = "123e4567-e89b-12d3-a456-426614174000";

describe("dashboard query authorization", () => {
  test("accepts a fresh assertion for the operation it signed", async () => {
    const authorization = await signDashboardAuthorization("dashboard-summary", SECRET, {
      timestamp: NOW,
      nonce: NONCE,
    });

    await expect(
      verifyDashboardAuthorization("dashboard-summary", authorization, SECRET, NOW),
    ).resolves.toBe(true);
  });

  test("rejects cross-operation replay and tampering", async () => {
    const authorization = await signDashboardAuthorization("dashboard-summary", SECRET, {
      timestamp: NOW,
      nonce: NONCE,
    });

    await expect(
      verifyDashboardAuthorization("cli-usage-summary", authorization, SECRET, NOW),
    ).resolves.toBe(false);
    await expect(
      verifyDashboardAuthorization(
        "dashboard-summary",
        { ...authorization, signature: `${authorization.signature.slice(0, -1)}0` },
        SECRET,
        NOW,
      ),
    ).resolves.toBe(false);
  });

  test("rejects expired and future assertions", async () => {
    const expired = await signDashboardAuthorization("dashboard-summary", SECRET, {
      timestamp: NOW - 30_001,
      nonce: NONCE,
    });
    const future = await signDashboardAuthorization("dashboard-summary", SECRET, {
      timestamp: NOW + 5_001,
      nonce: NONCE,
    });

    await expect(
      verifyDashboardAuthorization("dashboard-summary", expired, SECRET, NOW),
    ).resolves.toBe(false);
    await expect(
      verifyDashboardAuthorization("dashboard-summary", future, SECRET, NOW),
    ).resolves.toBe(false);
  });
});
