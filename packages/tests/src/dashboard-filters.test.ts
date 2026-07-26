import { describe, expect, test } from "vitest";
import { filterDashboardEvents } from "../../site/convex/dashboardFilters.js";

describe("dashboard filters", () => {
  test("combines the date range and selected install across dashboard events", () => {
    const events = [
      { id: "old-a", installId: "install-a", receivedAt: 99 },
      { id: "current-a", installId: "install-a", receivedAt: 200 },
      { id: "current-b", installId: "install-b", receivedAt: 300 },
    ];

    expect(filterDashboardEvents(events, { since: 100, installId: "install-a" })).toEqual([
      events[1],
    ]);
  });
});
