import type { ApiResponse } from "./types.js";

export interface FieldViolation {
  field: string;
  message: string;
  [key: string]: unknown;
}

export interface VeriqErrorBody extends Partial<ApiResponse> {
  code?: string;
  message?: string;
  detail?: string | null;
  retry_after_seconds?: number | null;
  field_violations?: FieldViolation[];
  documentation_url?: string;
  [key: string]: unknown;
}

export interface VeriqErrorOptions {
  requestId?: string | undefined;
  retryable?: boolean | undefined;
  cause?: unknown;
}

export class VeriqError extends Error {
  readonly requestId: string | undefined;
  readonly retryable: boolean;

  constructor(message: string, options: VeriqErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = "VeriqError";
    this.requestId = options.requestId;
    this.retryable = options.retryable ?? false;
  }
}

export class VeriqApiError extends VeriqError {
  readonly status: number;
  readonly code: string | undefined;
  readonly detail: string | null | undefined;
  readonly retryAfterSeconds: number | null | undefined;
  readonly fieldViolations: FieldViolation[];
  readonly documentationUrl: string | undefined;
  readonly body: VeriqErrorBody;
  readonly headers: Headers;

  constructor(status: number, body: VeriqErrorBody, headers: Headers, fallbackRequestId?: string) {
    const requestId =
      (typeof body.request_id === "string" ? body.request_id : undefined) ??
      headers.get("x-request-id") ??
      fallbackRequestId;
    super(body.message ?? `Veriq API request failed with status ${status}`, {
      requestId,
      retryable: body.retryable ?? false,
    });
    this.name = "VeriqApiError";
    this.status = status;
    this.code = body.code;
    this.detail = body.detail;
    this.retryAfterSeconds = body.retry_after_seconds;
    this.fieldViolations = body.field_violations ?? [];
    this.documentationUrl = body.documentation_url;
    this.body = body;
    this.headers = headers;
  }
}

export class VeriqNetworkError extends VeriqError {
  readonly timedOut: boolean;
  readonly aborted: boolean;

  constructor(
    message: string,
    options: VeriqErrorOptions & { timedOut?: boolean; aborted?: boolean } = {},
  ) {
    super(message, options);
    this.name = "VeriqNetworkError";
    this.timedOut = options.timedOut ?? false;
    this.aborted = options.aborted ?? false;
  }
}

export class VeriqResponseError extends VeriqError {
  readonly status: number | undefined;

  constructor(
    message: string,
    options: VeriqErrorOptions & { status?: number | undefined } = {},
  ) {
    super(message, options);
    this.name = "VeriqResponseError";
    this.status = options.status;
  }
}

export class VeriqJobTimeoutError extends VeriqError {
  readonly jobId: string;
  readonly timeoutMs: number;

  constructor(jobId: string, timeoutMs: number, requestId?: string) {
    super(`Timed out waiting ${timeoutMs}ms for job ${jobId}`, { requestId, retryable: true });
    this.name = "VeriqJobTimeoutError";
    this.jobId = jobId;
    this.timeoutMs = timeoutMs;
  }
}
