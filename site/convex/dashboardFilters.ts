export function filterDashboardEvents<T extends { installId: string; receivedAt: number }>(
  events: T[],
  filters: { since: number; installId?: string; excludedInstallIds?: ReadonlySet<string> },
): T[] {
  return events.filter(
    (event) =>
      event.receivedAt >= filters.since &&
      (filters.installId === undefined || event.installId === filters.installId) &&
      !filters.excludedInstallIds?.has(event.installId),
  );
}

export function parseInstallIdList(...values: Array<string | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .flatMap((value) => value?.split(/[\s,]+/) ?? [])
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}
