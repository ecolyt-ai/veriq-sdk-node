import { createHmac, timingSafeEqual } from "node:crypto";

export const VERIQ_EVENT_ID_HEADER = "Veriq-Event-Id";
export const VERIQ_TIMESTAMP_HEADER = "Veriq-Timestamp";
export const VERIQ_SIGNATURE_HEADER = "Veriq-Signature";
export const DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300;

export type WebhookHeaders = Headers | Record<string, string | string[] | undefined>;

export interface VerifyWebhookOptions {
  tolerance_seconds?: number;
  now?: Date | number;
}

export interface VerifiedWebhook {
  event_id: string;
  timestamp: number;
  signature: string;
}

export class VeriqWebhookVerificationError extends Error {
  readonly code:
    | "missing_header"
    | "invalid_timestamp"
    | "timestamp_outside_tolerance"
    | "invalid_secret"
    | "invalid_signature";

  constructor(code: VeriqWebhookVerificationError["code"], message: string) {
    super(message);
    this.name = "VeriqWebhookVerificationError";
    this.code = code;
  }
}

function getHeader(headers: WebhookHeaders, name: string): string | undefined {
  if (headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }

  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== target || value === undefined) continue;
    return Array.isArray(value) ? value.join(",") : value;
  }
  return undefined;
}

function signatureCandidates(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .map((item) => {
      const separator = item.indexOf("=");
      if (separator === -1) return item;
      const scheme = item.slice(0, separator).toLowerCase();
      return scheme === "v1" || scheme === "sha256" ? item.slice(separator + 1) : "";
    })
    .filter((item) => /^[a-f\d]{64}$/iu.test(item));
}

/**
 * Verify a webhook over the exact raw request body. The signed message is
 * `${timestamp}.${eventId}.${rawBody}` and signatures may be plain hex, `v1=<hex>`,
 * or `sha256=<hex>`. The timestamp is Unix time in seconds.
 */
export function verifyWebhookSignature(
  rawBody: string | Uint8Array,
  headers: WebhookHeaders,
  secret: string | Uint8Array,
  options: VerifyWebhookOptions = {},
): VerifiedWebhook {
  if (secret.length === 0) {
    throw new VeriqWebhookVerificationError(
      "invalid_secret",
      "Webhook secret must not be empty",
    );
  }

  const eventId = getHeader(headers, VERIQ_EVENT_ID_HEADER);
  const timestampValue = getHeader(headers, VERIQ_TIMESTAMP_HEADER);
  const signatureValue = getHeader(headers, VERIQ_SIGNATURE_HEADER);

  if (!eventId) {
    throw new VeriqWebhookVerificationError("missing_header", `Missing ${VERIQ_EVENT_ID_HEADER}`);
  }
  if (!timestampValue) {
    throw new VeriqWebhookVerificationError("missing_header", `Missing ${VERIQ_TIMESTAMP_HEADER}`);
  }
  if (!signatureValue) {
    throw new VeriqWebhookVerificationError("missing_header", `Missing ${VERIQ_SIGNATURE_HEADER}`);
  }

  const timestamp = Number(timestampValue);
  if (!Number.isSafeInteger(timestamp) || timestamp < 0) {
    throw new VeriqWebhookVerificationError(
      "invalid_timestamp",
      `${VERIQ_TIMESTAMP_HEADER} must be a Unix timestamp in seconds`,
    );
  }

  const tolerance = options.tolerance_seconds ?? DEFAULT_WEBHOOK_TOLERANCE_SECONDS;
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    throw new RangeError("tolerance_seconds must be a non-negative finite number");
  }
  const nowMs = options.now instanceof Date ? options.now.getTime() : (options.now ?? Date.now());
  const nowSeconds = Math.floor(nowMs / 1000);
  if (Math.abs(nowSeconds - timestamp) > tolerance) {
    throw new VeriqWebhookVerificationError(
      "timestamp_outside_tolerance",
      "Webhook timestamp is outside the allowed tolerance",
    );
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestampValue}.${eventId}.`, "utf8")
    .update(rawBody)
    .digest();
  const candidates = signatureCandidates(signatureValue);
  const valid = candidates.some((candidate) => {
    const supplied = Buffer.from(candidate, "hex");
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  });
  if (!valid) {
    throw new VeriqWebhookVerificationError("invalid_signature", "Webhook signature is invalid");
  }

  return { event_id: eventId, timestamp, signature: expected.toString("hex") };
}
