import {
  type DashboardOperation,
  signDashboardAuthorization,
} from "../../shared/dashboardAuthorization";

export async function createDashboardQueryAuthorization(operation: DashboardOperation) {
  const secret = process.env.DASHBOARD_QUERY_SECRET ?? process.env.DASHBOARD_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Dashboard query authorization is not configured");
  }
  return signDashboardAuthorization(operation, secret);
}
