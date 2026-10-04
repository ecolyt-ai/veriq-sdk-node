import { randomUUID } from "node:crypto";

import {
  VeriqApiError,
  VeriqJobTimeoutError,
  VeriqNetworkError,
  VeriqResponseError,
  type VeriqErrorBody,
} from "./errors.js";
import type {
  ApiRequestOptions,
  CrawlJobResponse,
  CrawlOptions,
  ExtractOptions,
  ExtractResponse,
  JobAcceptedResponse,
  JobCancellationResponse,
  JobResultDocument,
  JobResultsOptions,
  JobResultsPage,
  JobStatusResponse,
  MapOptions,
  MapResponse,
  SearchOptions,
  SearchResponse,
  WaitForJobOptions,
} from "./types.js";

export const DEFAULT_BASE_URL = "https://1xph5yqrc2.execute-api.us-east-1.amazonaws.com";
export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_MAX_RESPONSE_BYTES = 50 * 1024 * 1024;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_MAX_RETRY_DELAY_MS = 30_000;
const DEFAULT_WAIT_TIMEOUT_MS = 300_000;
const DEFAULT_POLL_INTERVAL_MS = 1_000;
const USER_AGENT = "veriq-node/0.2.0";
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
const CHARGED_CREATE_PATHS = new Set(["/v1/search", "/v1/extract", "/v1/crawl", "/v1/map"]);
const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);
const TERMINAL_LIFECYCLES = new Set(["terminal", "expired"]);

type FetchFunction = typeof globalThis.fetch;

export interface VeriqClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  maxRetryDelayMs?: number;
  maxResponseBytes?: number;
  fetch?: FetchFunction;
}

interface InternalRequest {
  method: "GET" | "POST" | "DELETE";
  path: string;
  body?: unknown;
  options?: ApiRequestOptions;
  idempotencyKey?: string | undefined;
  retryEligible: boolean;
  authenticated?: boolean | undefined;
}

export class VeriqClient {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly maxRetryDelayMs: number;
  readonly maxResponseBytes: number;
  private readonly fetchFn: FetchFunction;

  constructor(options: VeriqClientOptions) {
    if (!options.apiKey) throw new TypeError("apiKey is required");
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/u, "");
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.maxRetryDelayMs = options.maxRetryDelayMs ?? DEFAULT_MAX_RETRY_DELAY_MS;
    this.maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
    this.fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);

    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) {
      throw new RangeError("timeoutMs must be a positive finite number");
    }
    if (!Number.isSafeInteger(this.maxRetries) || this.maxRetries < 0) {
      throw new RangeError("maxRetries must be a non-negative integer");
    }
    if (!Number.isFinite(this.maxRetryDelayMs) || this.maxRetryDelayMs < 0) {
      throw new RangeError("maxRetryDelayMs must be a non-negative finite number");
    }
    if (!Number.isSafeInteger(this.maxResponseBytes) || this.maxResponseBytes <= 0) {
      throw new RangeError("maxResponseBytes must be a positive integer");
    }
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    const body: Record<string, unknown> = {
      query,
      search_depth: options.search_depth ?? "basic",
      topic: options.topic ?? "general",
      max_results: options.max_results ?? 10,
      include_answer: options.include_answer ?? false,
      include_raw_content: options.include_raw_content ?? false,
      freshness_mode: options.freshness_mode ?? "best_effort",
      purpose: options.purpose ?? "user_directed_retrieval",
      cache_mode: options.cache_mode ?? "default",
    };
    if (options.include_domains?.length) body.include_domains = [...options.include_domains];
    if (options.exclude_domains?.length) body.exclude_domains = [...options.exclude_domains];
    if (options.days !== undefined) body.days = options.days;

    return this.requestJson<SearchResponse>({
      method: "POST",
      path: "/v1/search",
      body,
      options,
      idempotencyKey: options.idempotency_key,
      retryEligible: options.idempotency_key !== undefined,
    });
  }

  async extract(
    urls: string[],
    options: ExtractOptions = {},
  ): Promise<ExtractResponse | JobAcceptedResponse> {
    const body: Record<string, unknown> = {
      urls: [...urls],
      format: options.format ?? "markdown",
      include_metadata: options.include_metadata ?? true,
      purpose: options.purpose ?? "extraction",
      render: options.render ?? "http_only",
      execution_mode: options.execution_mode ?? "auto",
    };
    if (options.idempotency_key !== undefined) body.idempotency_key = options.idempotency_key;
    if (options.callback_url !== undefined) body.callback_url = options.callback_url;
    if (options.callback_secret !== undefined) body.callback_secret = options.callback_secret;

    return this.requestJson<ExtractResponse | JobAcceptedResponse>({
      method: "POST",
      path: "/v1/extract",
      body,
      options,
      idempotencyKey: options.idempotency_key,
      retryEligible: options.idempotency_key !== undefined,
    });
  }

  async map(
    url: string,
    options: MapOptions = {},
  ): Promise<MapResponse | JobAcceptedResponse> {
    const body: Record<string, unknown> = {
      url,
      max_depth: options.max_depth ?? 2,
      max_urls: options.max_urls ?? 100,
      include_patterns: [...(options.include_patterns ?? [])],
      exclude_patterns: [...(options.exclude_patterns ?? [])],
      purpose: options.purpose ?? "user_directed_retrieval",
      allowed_domains: [...(options.allowed_domains ?? [])],
      preserve_query: options.preserve_query ?? true,
      execution_mode: options.execution_mode ?? "auto",
    };
    if (options.idempotency_key !== undefined) body.idempotency_key = options.idempotency_key;
    if (options.callback_url !== undefined) body.callback_url = options.callback_url;
    if (options.callback_secret !== undefined) body.callback_secret = options.callback_secret;

    return this.requestJson<MapResponse | JobAcceptedResponse>({
      method: "POST",
      path: "/v1/map",
      body,
      options,
      idempotencyKey: options.idempotency_key,
      retryEligible: options.idempotency_key !== undefined,
    });
  }

  async crawl(url: string, options: CrawlOptions = {}): Promise<CrawlJobResponse> {
    const body: Record<string, unknown> = {
      url,
      max_depth: options.max_depth ?? 2,
      max_pages: options.max_pages ?? 50,
      include_patterns: [...(options.include_patterns ?? [])],
      exclude_patterns: [...(options.exclude_patterns ?? [])],
      purpose: options.purpose ?? "user_directed_retrieval",
      allowed_domains: [...(options.allowed_domains ?? [])],
    };
    if (options.callback_url !== undefined) body.callback_url = options.callback_url;
    if (options.callback_secret !== undefined) body.callback_secret = options.callback_secret;
    if (options.idempotency_key !== undefined) body.idempotency_key = options.idempotency_key;
    if (options.max_billable_units !== undefined) {
      body.max_billable_units = options.max_billable_units;
    }

    return this.requestJson<CrawlJobResponse>({
      method: "POST",
      path: "/v1/crawl",
      body,
      options,
      idempotencyKey: options.idempotency_key,
      retryEligible: options.idempotency_key !== undefined,
    });
  }

  async getJob(jobId: string, options: ApiRequestOptions = {}): Promise<JobStatusResponse> {
    return this.requestJson<JobStatusResponse>({
      method: "GET",
      path: `/v1/jobs/${encodeURIComponent(jobId)}`,
      options,
      retryEligible: true,
    });
  }

  async cancelJob(
    jobId: string,
    options: ApiRequestOptions = {},
  ): Promise<JobCancellationResponse> {
    return this.requestJson<JobCancellationResponse>({
      method: "DELETE",
      path: `/v1/jobs/${encodeURIComponent(jobId)}`,
      options,
      retryEligible: true,
    });
  }

  async waitForJob(
    jobId: string,
    options: WaitForJobOptions = {},
  ): Promise<JobStatusResponse> {
    const timeoutMs = options.timeout_ms ?? DEFAULT_WAIT_TIMEOUT_MS;
    const pollIntervalMs = options.poll_interval_ms ?? DEFAULT_POLL_INTERVAL_MS;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new RangeError("timeout_ms must be a positive finite number");
    }
    if (!Number.isFinite(pollIntervalMs) || pollIntervalMs < 0) {
      throw new RangeError("poll_interval_ms must be a non-negative finite number");
    }

    const startedAt = Date.now();
    let lastRequestId = options.request_id;
    while (true) {
      const job = await this.getJob(jobId, options);
      lastRequestId = job.request_id;
      if (TERMINAL_LIFECYCLES.has(job.lifecycle_state) || TERMINAL_STATUSES.has(job.status)) {
        return job;
      }

      const elapsed = Date.now() - startedAt;
      const remaining = timeoutMs - elapsed;
      if (remaining <= 0) throw new VeriqJobTimeoutError(jobId, timeoutMs, lastRequestId);
      await sleep(Math.min(pollIntervalMs, remaining), options.signal, lastRequestId);
      if (Date.now() - startedAt >= timeoutMs) {
        throw new VeriqJobTimeoutError(jobId, timeoutMs, lastRequestId);
      }
    }
  }

  /**
   * Calls the anticipated additive result-page endpoint. Servers that do not yet expose
   * this route will return a typed VeriqApiError; no fallback wire shape is invented.
   */
  async getJobResults<T = Record<string, unknown>>(
    jobId: string,
    options: JobResultsOptions = {},
  ): Promise<JobResultsPage<T>> {
    const search = new URLSearchParams();
    if (options.limit !== undefined) search.set("limit", String(options.limit));
    if (options.cursor !== undefined) search.set("cursor", options.cursor);
    const query = search.size ? `?${search.toString()}` : "";
    return this.requestJson<JobResultsPage<T>>({
      method: "GET",
      path: `/v1/jobs/${encodeURIComponent(jobId)}/results${query}`,
      options,
      retryEligible: true,
    });
  }

  /** Get a fresh presigned result URL from job status, then retrieve its JSON document. */
  async fetchJobResult<T = JobResultDocument>(
    jobId: string,
    options: ApiRequestOptions = {},
  ): Promise<T> {
    const job = await this.getJob(jobId, options);
    if (!job.results_url) {
      throw new VeriqResponseError(`Job ${jobId} does not currently have a results_url`, {
        requestId: job.request_id,
        retryable: job.lifecycle_state !== "expired" && !TERMINAL_STATUSES.has(job.status),
      });
    }
    return this.requestJson<T>({
      method: "GET",
      path: job.results_url,
      options,
      retryEligible: true,
      authenticated: false,
    });
  }

  private async requestJson<T>(request: InternalRequest): Promise<T> {
    const authenticated = request.authenticated ?? true;
    const requestId = request.options?.request_id ?? randomUUID();
    const generatedIdempotencyKey =
      authenticated &&
      request.method === "POST" &&
      CHARGED_CREATE_PATHS.has(request.path) &&
      request.idempotencyKey === undefined;
    const effectiveIdempotencyKey = generatedIdempotencyKey
      ? randomUUID()
      : request.idempotencyKey;
    const effectiveRetryEligible = request.retryEligible || generatedIdempotencyKey;
    const url = /^https:\/\//u.test(request.path) ? request.path : `${this.baseUrl}${request.path}`;
    const serializedBody = request.body === undefined ? undefined : JSON.stringify(request.body);

    for (let attempt = 0; ; attempt += 1) {
      const headers = new Headers();
      if (authenticated) {
        headers.set("X-Api-Key", this.apiKey);
        headers.set("X-Request-ID", requestId);
        headers.set("User-Agent", USER_AGENT);
        headers.set("Content-Type", "application/json");
      }
      if (effectiveIdempotencyKey !== undefined) {
        headers.set("Idempotency-Key", effectiveIdempotencyKey);
      }

      let response: Response;
      let timedOut = false;
      const controller = new AbortController();
      const externalSignal = request.options?.signal;
      const abortFromExternal = (): void => controller.abort(externalSignal?.reason);
      if (externalSignal?.aborted) abortFromExternal();
      else externalSignal?.addEventListener("abort", abortFromExternal, { once: true });
      const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort(new Error(`Request timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      const cleanup = (): void => {
        clearTimeout(timeout);
        externalSignal?.removeEventListener("abort", abortFromExternal);
      };

      try {
        const init: RequestInit = {
          method: request.method,
          headers,
          signal: controller.signal,
          redirect: authenticated ? "error" : "follow",
        };
        if (serializedBody !== undefined) init.body = serializedBody;
        response = await this.fetchFn(url, init);
      } catch (cause) {
        cleanup();
        const aborted = externalSignal?.aborted ?? false;
        const retryable = effectiveRetryEligible && !aborted;
        if (retryable && attempt < this.maxRetries) {
          await sleep(this.retryDelayMs(attempt), externalSignal, requestId);
          continue;
        }
        throw new VeriqNetworkError(
          timedOut ? `Veriq request timed out after ${this.timeoutMs}ms` : "Veriq network request failed",
          { requestId, retryable, cause, timedOut, aborted },
        );
      }

      if (
        !response.ok &&
        effectiveRetryEligible &&
        RETRYABLE_STATUS_CODES.has(response.status) &&
        attempt < this.maxRetries
      ) {
        const delay = this.retryDelayMs(attempt, response.headers.get("retry-after"));
        controller.abort();
        cleanup();
        await sleep(delay, externalSignal, requestId);
        continue;
      }

      let responseText: string;
      try {
        responseText = await readResponseText(response, this.maxResponseBytes);
      } catch (cause) {
        cleanup();
        if (cause instanceof ResponseBodyLimitError) {
          throw new VeriqResponseError(cause.message, {
            requestId: response.headers.get("x-request-id") ?? requestId,
            status: response.status,
            cause,
          });
        }
        const aborted = externalSignal?.aborted ?? false;
        const retryable = effectiveRetryEligible && !aborted;
        if (retryable && attempt < this.maxRetries) {
          await sleep(this.retryDelayMs(attempt), externalSignal, requestId);
          continue;
        }
        throw new VeriqNetworkError(
          timedOut
            ? `Veriq response timed out after ${this.timeoutMs}ms`
            : "Failed to read the Veriq response body",
          { requestId, retryable, cause, timedOut, aborted },
        );
      }
      cleanup();
      let parsed: unknown;
      try {
        parsed = responseText ? JSON.parse(responseText) : {};
      } catch (cause) {
        throw new VeriqResponseError("Veriq response was not valid JSON", {
          requestId: response.headers.get("x-request-id") ?? requestId,
          retryable: false,
          cause,
          status: response.status,
        });
      }

      if (!response.ok) {
        const body: VeriqErrorBody = isRecord(parsed)
          ? parsed
          : { message: responseText || `Request failed with status ${response.status}` };
        if (
          response.status === 409 &&
          request.method === "POST" &&
          effectiveRetryEligible &&
          effectiveIdempotencyKey !== undefined &&
          body.code === "idempotency_in_progress" &&
          attempt < this.maxRetries
        ) {
          const delay = this.retryDelayMs(attempt, response.headers.get("retry-after"));
          controller.abort();
          await sleep(delay, externalSignal, requestId);
          continue;
        }
        throw new VeriqApiError(response.status, body, response.headers, requestId);
      }
      if (!isRecord(parsed)) {
        throw new VeriqResponseError("Veriq response JSON must be an object", {
          requestId: response.headers.get("x-request-id") ?? requestId,
          status: response.status,
        });
      }

      const headerRequestId = response.headers.get("x-request-id");
      if (authenticated && typeof parsed.request_id !== "string") {
        parsed.request_id = headerRequestId ?? requestId;
      }
      return parsed as T;
    }
  }

  private retryDelayMs(attempt: number, retryAfter?: string | null): number {
    const serverDelay = parseRetryAfterMs(retryAfter);
    if (serverDelay !== undefined) return Math.min(serverDelay, this.maxRetryDelayMs);
    const exponential = Math.min(250 * 2 ** attempt, this.maxRetryDelayMs);
    return Math.min(
      Math.floor(exponential * (0.75 + Math.random() * 0.5)),
      this.maxRetryDelayMs,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRetryAfterMs(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(value);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, date - Date.now());
}

function sleep(ms: number, signal?: AbortSignal, requestId?: string): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(
      new VeriqNetworkError("Veriq request was aborted", {
        requestId,
        aborted: true,
        cause: signal.reason,
      }),
    );
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(
        new VeriqNetworkError("Veriq request was aborted", {
          requestId,
          aborted: true,
          cause: signal?.reason,
        }),
      );
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

class ResponseBodyLimitError extends Error {
  constructor(maxBytes: number) {
    super(`Veriq response exceeded the ${maxBytes}-byte response limit`);
    this.name = "ResponseBodyLimitError";
  }
}

async function readResponseText(response: Response, maxBytes: number): Promise<string> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new ResponseBodyLimitError(maxBytes);
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > maxBytes) {
        await reader.cancel();
        throw new ResponseBodyLimitError(maxBytes);
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
