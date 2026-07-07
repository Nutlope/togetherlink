import { assert, looksLikeContextError } from "./assert.js";
import {
  deleteSession,
  registerClaudeSession,
  registerCodexSession,
  startTestDaemon,
} from "./daemon-session.js";
import { makeLongRecords } from "./long-context.js";
import type { TestContext } from "./types.js";

export async function assertClaudeContextLimitRetry(context: TestContext): Promise<void> {
  const daemon = await startTestDaemon(context);
  const token = await registerClaudeSession(context, daemon);
  try {
    const prompt = [
      "This request intentionally exceeds the model context window when paired with the requested max_tokens.",
      "If the proxy retries correctly with a reduced max_tokens value, answer exactly: CONTEXT_RETRY_OK",
      makeLongRecords(1_650, "CLAUDE_CONTEXT_RETRY_FINAL"),
    ].join("\n\n");
    const response = await fetch(`${daemon.url}/v1/messages`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "together-glm-5-2",
        max_tokens: 164000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const text = await response.text();
    assert(
      response.ok,
      `expected context-limit retry to recover, got ${response.status}: ${text.slice(0, 1000)}`,
    );
    assert(!looksLikeContextError(text), "context-length error leaked to the client");
    const stderr = daemon.stderr();
    assert(
      stderr.includes("retrying together request with reduced max_tokens") ||
        stderr.includes("clamped request max_tokens to estimated context budget") ||
        stderr.includes("trimmed request input to reserve requested output") ||
        (stderr.includes("togetherlink: trimmed") && stderr.includes("(retry path")) ||
        (stderr.includes("togetherlink: DROPPED A LARGE PORTION") &&
          stderr.includes("(retry path")),
      "daemon did not log context-limit prevention",
    );
    assert(/CONTEXT_RETRY_OK/i.test(text), "retry response did not include expected final answer");
  } finally {
    await deleteSession(daemon, token);
    await daemon.stop();
  }
}

export async function assertCodexContextLimitRetry(context: TestContext): Promise<void> {
  const daemon = await startTestDaemon(context);
  const token = await registerCodexSession(context, daemon);
  try {
    const prompt = [
      "This Responses request intentionally exceeds the model context window when paired with the requested max_output_tokens.",
      "If the proxy retries correctly with a reduced max_tokens value, answer exactly: CODEX_CONTEXT_RETRY_OK",
      makeLongRecords(1_650, "CODEX_CONTEXT_RETRY_FINAL"),
    ].join("\n\n");
    const response = await fetch(`${daemon.url}/v1/responses`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "zai-org/GLM-5.2",
        max_output_tokens: 164000,
        input: [{ type: "message", role: "user", content: [{ type: "input_text", text: prompt }] }],
      }),
    });
    const text = await response.text();
    assert(
      response.ok,
      `expected context-limit retry to recover, got ${response.status}: ${text.slice(0, 1000)}`,
    );
    assert(!looksLikeContextError(text), "context-length error leaked to the client");
    assert(
      daemon.stderr().includes("[togetherlink proxy] context-fit retry"),
      "daemon did not log Codex context-limit retry",
    );
    assert(
      /CODEX_CONTEXT_RETRY_OK/i.test(text),
      "retry response did not include expected final answer",
    );
  } finally {
    await deleteSession(daemon, token);
    await daemon.stop();
  }
}
