export function filterDashboardEvents<T extends { installId: string; receivedAt: number }>(
  events: T[],
  filters: { since: number; installId?: string },
): T[] {
  return events.filter(
    (event) =>
      event.receivedAt >= filters.since &&
      (filters.installId === undefined || event.installId === filters.installId),
  );
}
