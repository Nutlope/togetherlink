type JsonObject = Record<string, unknown>;
const MAX_NATIVE_REASONING_SIGNATURE_BYTES = 32 * 1024 * 1024;

/**
 * Make client-owned Responses history safe to replay to native Codex.
 *
 * Codex uses stateless `store: false` requests. A reasoning item with an id
 * but no usable encrypted_content is interpreted by the native backend as a
 * lookup for an item that was never stored, producing a 404. Keep the
 * reasoning summary/content, but remove the unusable transport state.
 */
export function sanitizeNativeResponsesReplay<T extends JsonObject>(body: T): T {
  if (body.store === true || !Array.isArray(body.input)) {
    return body;
  }

  let changed = false;
  const input = body.input.map((value) => {
    if (!isJsonObject(value) || value.type !== "reasoning") {
      return value;
    }
    const encryptedContent = value.encrypted_content;
    if (
      typeof encryptedContent === "string" &&
      isValidNativeReasoningEncryptedContent(encryptedContent)
    ) {
      return value;
    }
    if (!("id" in value) && !("encrypted_content" in value)) {
      return value;
    }
    const { id: _orphanId, encrypted_content: _invalidEncryptedContent, ...safe } = value;
    changed = true;
    return safe;
  });

  return changed ? ({ ...body, input } as T) : body;
}

function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Validate the Fernet-like transport envelope used by native Codex reasoning. */
function isValidNativeReasoningEncryptedContent(value: string): boolean {
  if (
    value === "" ||
    value !== value.trim() ||
    value.length > MAX_NATIVE_REASONING_SIGNATURE_BYTES ||
    !value.startsWith("gAAAA") ||
    !/^[A-Za-z0-9_-]+={0,2}$/.test(value)
  ) {
    return false;
  }
  let decoded: Buffer;
  try {
    decoded = Buffer.from(value, "base64url");
  } catch {
    return false;
  }
  if (decoded.length < 73 || decoded[0] !== 0x80) {
    return false;
  }
  const ciphertextLength = decoded.length - 1 - 8 - 16 - 32;
  return ciphertextLength > 0 && ciphertextLength % 16 === 0;
}
