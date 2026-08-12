import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, test } from "vitest";
import { assert, assertCommandExists } from "./assert.js";
import { runCommand } from "./command.js";
import { cleanupTmpDir, createTestContext, resetTmpDir } from "./context.js";
import { asRecord, jsonLines } from "./json-lines.js";
import type { TestContext } from "./types.js";

const maybeDescribe = process.env.TOGETHERLINK_LIVE_PRIME_RLM === "1" ? describe : describe.skip;
const PRIME_RLM_MODEL = "zai-org/GLM-5.2";
const CHILD_NAME = "togetherlink-live-rlm-child";
const CHILD_TOKEN = "TOGETHERLINK_PRIME_RLM_CHILD_OK";
const PARENT_TOKEN = "TOGETHERLINK_PRIME_RLM_PARENT_OK";

maybeDescribe("live Prime Agent RLM", () => {
  let context: TestContext;

  beforeAll(async () => {
    assertCommandExists("prime-agent");
    context = await createTestContext();
    await resetTmpDir(context);
  });

  afterAll(async () => {
    if (context) {
      await cleanupTmpDir(context);
    }
  });

  test("a Together-backed parent delegates to a child and receives its reply", async () => {
    const runDir = path.join(context.tmpDir, "prime-rlm");
    const sessionDir = path.join(runDir, "sessions");
    const childArtifact = path.join(runDir, "child-token.txt");
    await mkdir(runDir, { recursive: true });
    const prompt = primeRlmPrompt(childArtifact);
    const result = await runCommand(
      context,
      "prime-rlm-parent-child",
      process.execPath,
      [
        context.cliBin,
        "--model",
        PRIME_RLM_MODEL,
        "prime",
        "--",
        "--mode",
        "json",
        "--session-dir",
        sessionDir,
        "-p",
        prompt,
      ],
      { timeoutMs: 300_000 },
    );

    assert(!result.timedOut, "Prime RLM smoke timed out");
    assert(result.status === 0, `Prime RLM smoke exited ${result.status}`);
    assert(
      (await readFile(childArtifact, "utf8")) === `${CHILD_TOKEN}\n`,
      "child artifact did not contain the exact token",
    );

    const transcriptPaths = (await findFiles(runDir)).filter((file) => file.endsWith(".jsonl"));
    const transcripts = await Promise.all(
      transcriptPaths.map(async (file) => ({
        file,
        events: jsonLines(await readFile(file, "utf8")),
      })),
    );
    const childTranscripts = transcripts.filter(({ events }) =>
      events.some((event) => asRecord(event).type === "session" && asRecord(event).rlmDepth === 1),
    );
    assert(childTranscripts.length === 1, `expected one RLM child, got ${childTranscripts.length}`);
    const childTranscript = childTranscripts[0];
    assert(childTranscript, "missing persisted RLM child transcript");

    const childEvents = childTranscript.events.map(asRecord);
    assert(
      childEvents.some((event) => event.type === "session_info" && event.name === CHILD_NAME),
      "RLM child transcript did not preserve the requested name",
    );
    assert(
      childEvents.some(
        (event) =>
          event.type === "model_change" &&
          event.provider === "togetherlink" &&
          event.modelId === PRIME_RLM_MODEL,
      ),
      "RLM child did not inherit the TogetherLink provider and model",
    );
    const childIpythonCalls = childEvents.flatMap((event) =>
      event.type === "message" ? ipythonCalls(asRecord(event.message)) : [],
    );
    assert(
      childIpythonCalls.length === 1,
      `expected one child IPython call, got ${childIpythonCalls.length}`,
    );
    assert(
      childSentParentMessage(String(childIpythonCalls[0]?.code ?? "")),
      "child IPython call did not send its parent message",
    );
    assert(
      childEvents.some((event) => sentParentMessage(event, CHILD_TOKEN)),
      "child transcript did not record a queued parent message",
    );

    const parentTranscript = transcripts.find(({ events }) =>
      events.some((event) => receivedChildMessage(asRecord(event), CHILD_TOKEN)),
    );
    assert(parentTranscript, "parent transcript did not receive the child message");
    assert(
      parentTranscript.events.some((event) => assistantText(asRecord(event)) === PARENT_TOKEN),
      "parent did not confirm the RLM lifecycle after receiving the child message",
    );
    assert(
      parentTranscript.events.some((event) => {
        const record = asRecord(event);
        return (
          record.type === "child_usage_attributed" &&
          asNumber(asRecord(record.childUsage).totalTokens) > 0
        );
      }),
      "parent transcript did not attribute child usage",
    );

    const parentArtifactName = "prime-rlm-parent.jsonl";
    const childTranscriptName = "prime-rlm-child.jsonl";
    await copyFile(parentTranscript.file, path.join(context.artifactsDir, parentArtifactName));
    await copyFile(childTranscript.file, path.join(context.artifactsDir, childTranscriptName));

    await writeFile(
      path.join(context.artifactsDir, "prime-rlm-evidence.json"),
      `${JSON.stringify(
        {
          model: `togetherlink/${PRIME_RLM_MODEL}`,
          childName: CHILD_NAME,
          childTranscript: childTranscriptName,
          parentTranscript: parentArtifactName,
          childToken: CHILD_TOKEN,
          parentToken: PARENT_TOKEN,
        },
        null,
        2,
      )}\n`,
    );
  });
});

function primeRlmPrompt(childArtifact: string): string {
  return [
    "Run this exact RLM lifecycle check without inspecting the RLM implementation.",
    "In one IPython call, use Prime's preloaded rlm callable to admit exactly one child",
    `named ${CHILD_NAME}. Tell the child to make exactly one IPython call that writes`,
    `exactly ${CHILD_TOKEN} plus one newline to ${childArtifact}, then executes`,
    `await agent_message.send('${CHILD_TOKEN}', receiver_role='parent') in that same cell.`,
    "After admission, keep the parent IPython cell alive with await asyncio.sleep(30).",
    `When the child message arrives, answer exactly ${PARENT_TOKEN}.`,
  ].join(" ");
}

function ipythonCalls(message: Record<string, unknown>): Array<Record<string, unknown>> {
  const content = Array.isArray(message.content) ? message.content : [];
  return content.flatMap((item) => {
    const record = asRecord(item);
    if (record.type !== "toolCall" || record.name !== "ipython") {
      return [];
    }
    return [asRecord(record.arguments)];
  });
}

function childSentParentMessage(code: string): boolean {
  return (
    code.includes("agent_message.send") &&
    code.includes(CHILD_TOKEN) &&
    code.includes("receiver_role") &&
    code.includes("parent")
  );
}

function assistantText(event: Record<string, unknown>): string | undefined {
  if (event.type !== "message") {
    return undefined;
  }
  const message = asRecord(event.message);
  if (message.role !== "assistant" || !Array.isArray(message.content)) {
    return undefined;
  }
  return message.content
    .map(asRecord)
    .filter((item) => item.type === "text")
    .map((item) => String(item.text ?? ""))
    .join("")
    .trim();
}

function sentParentMessage(event: Record<string, unknown>, expected: string): boolean {
  if (event.type !== "message") {
    return false;
  }
  const message = asRecord(event.message);
  if (message.role !== "toolResult") {
    return false;
  }
  const details = asRecord(message.details);
  const sent = Array.isArray(details.sentAgentMessages) ? details.sentAgentMessages : [];
  return sent.some((item) => {
    const record = asRecord(item);
    return (
      record.message === expected &&
      record.receiverRole === "parent" &&
      record.deliveryStatus === "queued"
    );
  });
}

function receivedChildMessage(event: Record<string, unknown>, expected: string): boolean {
  if (event.type !== "custom_message" || event.customType !== "agent_message") {
    return false;
  }
  const details = asRecord(event.details);
  return details.fromRelationship === "child" && details.message === expected;
}

async function findFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const resolved = path.join(directory, entry.name);
      return entry.isDirectory() ? findFiles(resolved) : [resolved];
    }),
  );
  return nested.flat();
}

function asNumber(value: unknown): number {
  return typeof value === "number" ? value : 0;
}
