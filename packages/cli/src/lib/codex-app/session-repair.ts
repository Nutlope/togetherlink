import path from "node:path";
import { copyFile, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import {
  isTogetherLinkReasoningId,
  sanitizeNativeResponsesReplay,
} from "../codex/native-replay.js";

type JsonObject = Record<string, unknown>;

export type CodexSessionRepairResult = {
  filesRepaired: number;
  itemsRepaired: number;
  backups: Array<{ sourcePath: string; backupPath: string }>;
};

/**
 * Repair Codex task history that contains replay-unsafe reasoning items emitted
 * by a non-OpenAI provider. Every changed JSONL file is copied to a timestamped
 * backup before an atomic rewrite. Summary text and all unrelated events stay
 * intact; only unusable reasoning ids/encrypted_content are removed.
 */
export async function repairCodexSessionHistory(home: string): Promise<CodexSessionRepairResult> {
  const codexHome = path.join(home, ".codex");
  const roots = [path.join(codexHome, "sessions"), path.join(codexHome, "archived_sessions")];
  const files = (await Promise.all(roots.map(jsonlFiles))).flat();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupRoot = path.join(
    process.env.TOGETHERLINK_HOME || path.join(home, ".togetherlink"),
    "backup",
    "codex-app",
    "session-repair",
    stamp,
  );
  const result: CodexSessionRepairResult = {
    filesRepaired: 0,
    itemsRepaired: 0,
    backups: [],
  };

  for (const sourcePath of files) {
    const original = await readFile(sourcePath, "utf8");
    let fileItemsRepaired = 0;
    const repaired = original
      .split("\n")
      .map((line) => {
        if (!line) return line;
        const event = parseJsonObject(line);
        const payload = event?.type === "response_item" ? event.payload : undefined;
        if (!isTogetherLinkReasoningPayload(payload)) {
          return line;
        }
        const sanitized = sanitizeNativeResponsesReplay({ store: false, input: [payload] });
        const safePayload = sanitized.input?.[0];
        if (safePayload === payload || !isJsonObject(safePayload)) {
          return line;
        }
        fileItemsRepaired += 1;
        return JSON.stringify({ ...event, payload: safePayload });
      })
      .join("\n");

    if (fileItemsRepaired === 0) {
      continue;
    }

    const relativePath = path.relative(codexHome, sourcePath);
    const backupPath = path.join(backupRoot, relativePath);
    await mkdir(path.dirname(backupPath), { recursive: true });
    await copyFile(sourcePath, backupPath);
    await writeTextAtomic(sourcePath, repaired);
    result.filesRepaired += 1;
    result.itemsRepaired += fileItemsRepaired;
    result.backups.push({ sourcePath, backupPath });
  }

  return result;
}

function isTogetherLinkReasoningPayload(value: unknown): value is JsonObject {
  return isJsonObject(value) && value.type === "reasoning" && isTogetherLinkReasoningId(value.id);
}

async function jsonlFiles(root: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return [];
    throw error;
  }
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(root, entry.name);
      if (entry.isDirectory()) return jsonlFiles(entryPath);
      return entry.isFile() && entry.name.endsWith(".jsonl") ? [entryPath] : [];
    }),
  );
  return nested.flat();
}

async function writeTextAtomic(file: string, value: string): Promise<void> {
  const temporary = `${file}.tmp-${process.pid}`;
  await writeFile(temporary, value, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, file);
}

function parseJsonObject(value: string): JsonObject | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    return isJsonObject(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
