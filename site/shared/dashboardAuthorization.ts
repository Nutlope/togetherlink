export type DashboardOperation = "dashboard-summary" | "cli-usage-summary" | "set-install-nickname";

export type DashboardAuthorization = {
  timestamp: number;
  nonce: string;
  signature: string;
};

const MAX_ASSERTION_AGE_MS = 30_000;
const MAX_CLOCK_SKEW_MS = 5_000;

function authorizationMessage(
  operation: DashboardOperation,
  timestamp: number,
  nonce: string,
): string {
  return `${operation}\n${timestamp}\n${nonce}`;
}

async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function signDashboardAuthorization(
  operation: DashboardOperation,
  secret: string,
  options: { timestamp?: number; nonce?: string } = {},
): Promise<DashboardAuthorization> {
  const timestamp = options.timestamp ?? Date.now();
  const nonce = options.nonce ?? crypto.randomUUID();
  const signature = await hmacSha256Hex(authorizationMessage(operation, timestamp, nonce), secret);
  return { timestamp, nonce, signature };
}

export async function verifyDashboardAuthorization(
  operation: DashboardOperation,
  authorization: DashboardAuthorization,
  secret: string,
  now = Date.now(),
): Promise<boolean> {
  if (
    !Number.isSafeInteger(authorization.timestamp) ||
    authorization.timestamp < now - MAX_ASSERTION_AGE_MS ||
    authorization.timestamp > now + MAX_CLOCK_SKEW_MS ||
    !/^[0-9a-f-]{16,64}$/i.test(authorization.nonce) ||
    !/^[0-9a-f]{64}$/i.test(authorization.signature)
  ) {
    return false;
  }
  const expected = await hmacSha256Hex(
    authorizationMessage(operation, authorization.timestamp, authorization.nonce),
    secret,
  );
  return constantTimeEqual(authorization.signature.toLowerCase(), expected);
}
