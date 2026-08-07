import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { repairCodexSessionHistory } from "../../cli/src/lib/codex-app/session-repair.js";

const temporaryHomes: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryHomes.splice(0).map((home) => rm(home, { recursive: true })));
});

describe("Codex App session repair", () => {
  test.each(["sessions", "archived_sessions"])(
    "backs up affected %s task files and preserves reasoning summaries while removing orphan state",
    async (sessionRoot) => {
      const home = await mkdtemp(path.join(os.tmpdir(), "togetherlink-codex-repair-"));
      temporaryHomes.push(home);
      const sessionPath = path.join(
        home,
        ".codex",
        sessionRoot,
        "2026",
        "08",
        "07",
        "rollout-test.jsonl",
      );
      await mkdir(path.dirname(sessionPath), { recursive: true });
      const originalLines = [
        {
          timestamp: "2026-08-07T07:27:41.985Z",
          type: "response_item",
          payload: {
            type: "reasoning",
            id: "rs_74de861d8b2b4283b4c1b291d2d7383d",
            summary: [{ type: "summary_text", text: "Keep this summary." }],
            encrypted_content: null,
            internal_chat_message_metadata_passthrough: { turn_id: "turn-1" },
          },
        },
        {
          timestamp: "2026-08-07T07:27:41.990Z",
          type: "response_item",
          payload: {
            type: "reasoning",
            id: "rs_0b41c8630c9e3463016a3b9d4a8d38819187fd3bcbe85b4b6b",
            summary: [],
            encrypted_content: null,
          },
        },
        {
          timestamp: "2026-08-07T07:27:41.996Z",
          type: "response_item",
          payload: {
            type: "message",
            id: "msg_1",
            role: "assistant",
            content: [{ type: "output_text", text: "Visible answer" }],
          },
        },
      ].map((line) => JSON.stringify(line));
      const original = `${originalLines.join("\n")}\n`;
      await writeFile(sessionPath, original);

      const result = await repairCodexSessionHistory(home);

      expect(result.filesRepaired).toBe(1);
      expect(result.itemsRepaired).toBe(1);
      expect(result.backups).toHaveLength(1);
      expect(await readFile(result.backups[0]!.backupPath, "utf8")).toBe(original);

      const repaired = (await readFile(sessionPath, "utf8"))
        .trimEnd()
        .split("\n")
        .map((line) => JSON.parse(line) as Record<string, unknown>);
      expect(repaired[0]).toMatchObject({
        type: "response_item",
        payload: {
          type: "reasoning",
          summary: [{ type: "summary_text", text: "Keep this summary." }],
          internal_chat_message_metadata_passthrough: { turn_id: "turn-1" },
        },
      });
      expect(repaired[0]?.payload).not.toHaveProperty("id");
      expect(repaired[0]?.payload).not.toHaveProperty("encrypted_content");
      expect(repaired[1]).toMatchObject({
        payload: {
          id: "rs_0b41c8630c9e3463016a3b9d4a8d38819187fd3bcbe85b4b6b",
          encrypted_content: null,
        },
      });
      expect(repaired[2]).toMatchObject({ payload: { id: "msg_1" } });
    },
  );
});
