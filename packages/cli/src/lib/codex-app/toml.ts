/**
 * TOML preamble manipulation for the codex-app config — the deep module behind
 * `buildCodexAppConfig`. Carved out of the former 722-line `codex-app.ts` so the
 * deletion test passes *inside* the file: TOML bugs now fix in the TOML module,
 * not inside an orchestrator that also knew about process lifecycle, file
 * backup, and session locks.
 *
 * Extracted as pure string functions — no I/O, no globals — so the upsert /
 * remove / split / section-removal logic is unit-testable through its
 * interface alone.
 */

export function removeManagedBlock(raw: string, markerStart: string, markerEnd: string): string {
  const start = raw.indexOf(markerStart);
  if (start < 0) {
    return raw;
  }
  const end = raw.indexOf(markerEnd, start);
  if (end < 0) {
    return raw;
  }
  const afterEnd = end + markerEnd.length;
  return `${raw.slice(0, start).trimEnd()}\n${raw.slice(afterEnd).replace(/^\s*\n/, "")}`;
}

export function removeTomlSections(raw: string, sectionNames: string[]): string {
  if (sectionNames.length === 0 || raw.trim() === "") {
    return raw;
  }
  const remove = new Set(sectionNames.map((section) => `[${section}]`));
  const lines = raw.split("\n");
  const kept: string[] = [];
  let skipping = false;

  for (const line of lines) {
    if (/^\s*\[/.test(line)) {
      skipping = remove.has(line.trim());
    }
    if (!skipping) {
      kept.push(line);
    }
  }

  return kept.join("\n").replace(/\n{3,}/g, "\n\n");
}

export function splitTomlPreamble(raw: string): [string, string] {
  const match = raw.match(/(?:^|\n)\s*\[/);
  if (!match || match.index === undefined) {
    return [raw, ""];
  }
  const tableStart = match[0].startsWith("\n") ? match.index + 1 : match.index;
  return [raw.slice(0, tableStart), raw.slice(tableStart)];
}

export function upsertTopLevelTomlKeys(preamble: string, values: Record<string, string>): string {
  const seen = new Set<string>();
  const lines = preamble.split(/\n/);
  const next = lines.map((line) => {
    const match = /^(\s*)([A-Za-z0-9_-]+)(\s*=\s*)(.*)$/.exec(line);
    if (!match) {
      return line;
    }
    const key = match[2];
    if (!key) {
      return line;
    }
    const value = values[key];
    if (value === undefined) {
      return line;
    }
    seen.add(key);
    return `${match[1] ?? ""}${key}${match[3] ?? " = "}${value}`;
  });
  const insertion = Object.entries(values)
    .filter(([key]) => !seen.has(key))
    .map(([key, value]) => `${key} = ${value}`);
  const compact = next.join("\n").trimEnd();
  const prefix = compact ? `${compact}\n` : "";
  return `${prefix}${insertion.join("\n")}${insertion.length > 0 ? "\n" : ""}`;
}

export function removeTopLevelTomlKeys(preamble: string, keys: string[]): string {
  const remove = new Set(keys);
  return preamble
    .split(/\n/)
    .filter((line) => {
      const match = /^(\s*)([A-Za-z0-9_-]+)(\s*=\s*)(.*)$/.exec(line);
      return !match || !remove.has(match[2] ?? "");
    })
    .join("\n");
}

export function tomlString(value: string): string {
  return JSON.stringify(value);
}
