import { v } from "convex/values";
import {
  type DashboardAuthorization,
  type DashboardOperation,
  verifyDashboardAuthorization,
} from "../shared/dashboardAuthorization";

export const dashboardAuthorizationValidator = v.object({
  timestamp: v.number(),
  nonce: v.string(),
  signature: v.string(),
});

export async function requireDashboardAuthorization(
  operation: DashboardOperation,
  authorization: DashboardAuthorization,
): Promise<void> {
  const secret = (
    globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env?.DASHBOARD_QUERY_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Dashboard authorization is not configured");
  }
  if (!(await verifyDashboardAuthorization(operation, authorization, secret))) {
    throw new Error("Not authorized");
  }
}
