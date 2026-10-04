export type Purpose =
  | "search_indexing"
  | "user_directed_retrieval"
  | "extraction"
  | "rag_context"
  | "model_training"
  | "customer_owned_site"
  | "licensed_collection";

export type ExecutionMode = "auto" | "sync" | "async";

export type LifecycleState = "accepted" | "queued" | "running" | "terminal" | "expired";
export type CompletionState =
  | "not_applicable"
  | "complete"
  | "partial"
  | "truncated"
  | "failed"
  | "cancelled";
export type ServiceMode = "normal" | "degraded";
export type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface ApiResponse {
  api_version: string;
  request_id: string;
  lifecycle_state: LifecycleState;
  completion_state: CompletionState;
  service_mode: ServiceMode;
  reason: string | null;
  retryable: boolean;
  [key: string]: unknown;
}

export interface CacheMetadata {
  hit: boolean;
  stored_at: string | null;
  age_seconds: number | null;
  policy_evaluated_at: string | null;
  expires_at: string | null;
  [key: string]: unknown;
}

export interface PolicyMetadata {
  purpose: Purpose;
  decision: "allowed" | "blocked" | "not_evaluated" | string;
  reason: string | null;
  policy_version: string;
  evaluated_at: string;
  robots_allowed: boolean | null;
  tdm_reserved: boolean | null;
  [key: string]: unknown;
}

export interface SafetyMetadata {
  detector: string;
  detector_version: string;
  severity: string;
  categories: string[];
  action: string;
  modified: boolean;
  withheld: boolean;
  [key: string]: unknown;
}

export interface FetchMetadata {
  submitted_url: string;
  final_url: string | null;
  redirect_chain: string[];
  fetched_at: string | null;
  status_code: number | null;
  content_type: string | null;
  bytes_fetched: number;
  bytes_returned: number;
  truncated: boolean;
  render_requested: string;
  render_effective: string;
  content_hash: string | null;
  [key: string]: unknown;
}

export interface BillingSummary {
  estimated_units: number;
  maximum_units: number;
  reserved_units: number;
  finalized_units: number;
  refunded_units: number;
  credits_remaining: number | null;
  policy_version: string;
  settlement_state: string;
  [key: string]: unknown;
}

export interface SearchOptions extends ApiRequestOptions {
  search_depth?: "basic" | "advanced";
  topic?: "general" | "news" | "academic";
  max_results?: number;
  include_answer?: boolean | "basic" | "advanced";
  include_raw_content?: boolean;
  include_domains?: string[];
  exclude_domains?: string[];
  days?: number;
  freshness_mode?: "strict" | "best_effort";
  purpose?: Purpose;
  cache_mode?: "default" | "bypass";
  idempotency_key?: string;
}

export interface ProviderAttemptMetadata {
  provider: string;
  status: string;
  result_count: number;
  reason: string | null;
  retryable: boolean;
  freshness_approximation: string | null;
  [key: string]: unknown;
}

export interface RawContentMetadata {
  requested: boolean;
  attempted: boolean;
  status: string;
  reason: string | null;
  retryable: boolean;
  render_mode: string | null;
  content_age_seconds: number | null;
  truncated: boolean;
  policy: PolicyMetadata | null;
  fetch: FetchMetadata | null;
  safety: SafetyMetadata | null;
  [key: string]: unknown;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  score: number;
  content: string | null;
  raw_content: string | null;
  published_date: string | null;
  source: string | null;
  canonical_url: string | null;
  sources: string[];
  freshness_status: "not_requested" | "within_window" | "out_of_window" | "unknown";
  raw_content_metadata: RawContentMetadata;
  [key: string]: unknown;
}

export interface AnswerMetadata {
  requested: boolean;
  status: string;
  reason: string | null;
  retryable: boolean;
  grounding_source: string | null;
  sources_considered: number;
  [key: string]: unknown;
}

export interface SearchResponse extends ApiResponse {
  query: string;
  answer: string | null;
  results: SearchResult[];
  search_depth: "basic" | "advanced";
  ranking_mode: string;
  serp_source: string;
  latency_ms: number;
  cached: boolean;
  purpose: Purpose;
  candidate_budget: number;
  candidate_count: number;
  filtered_count: number;
  duplicate_count: number;
  returned_count: number;
  shortfall_reason: string | null;
  freshness_mode: "strict" | "best_effort";
  freshness_unknown_count: number;
  provider_attempts: ProviderAttemptMetadata[];
  ranking_requested: string;
  ranking_fallback: boolean;
  score_interpretation: string;
  answer_metadata: AnswerMetadata;
  raw_content_attempted_count: number;
  cache: CacheMetadata;
  billing: BillingSummary;
}

export interface ExtractOptions extends ApiRequestOptions {
  format?: "markdown" | "text" | "html";
  include_metadata?: boolean;
  purpose?: Purpose;
  render?: "http_only" | "browser_render";
  execution_mode?: ExecutionMode;
  idempotency_key?: string;
  callback_url?: string;
  callback_secret?: string;
}

export interface ExtractionMetadata {
  title: string | null;
  author: string | null;
  published_date: string | null;
  provenance: string;
  unavailable_fields: string[];
  [key: string]: unknown;
}

export interface ExtractResult {
  url: string;
  status: string;
  title: string | null;
  author: string | null;
  published_date: string | null;
  content: string | null;
  word_count: number | null;
  render_mode: string | null;
  error: string | null;
  reason: string | null;
  retryable: boolean;
  latency_ms: number;
  content_type: string | null;
  bytes_fetched: number;
  bytes_returned: number;
  truncated: boolean;
  metadata: ExtractionMetadata | null;
  policy: PolicyMetadata;
  fetch: FetchMetadata;
  safety: SafetyMetadata;
  [key: string]: unknown;
}

export interface ExtractResponse extends ApiResponse {
  results: ExtractResult[];
  format: "markdown" | "text" | "html";
  latency_ms: number;
  billing: BillingSummary;
}

export interface MapOptions extends ApiRequestOptions {
  max_depth?: number;
  max_urls?: number;
  include_patterns?: string[];
  exclude_patterns?: string[];
  purpose?: Purpose;
  allowed_domains?: string[];
  preserve_query?: boolean;
  execution_mode?: ExecutionMode;
  idempotency_key?: string;
  callback_url?: string;
  callback_secret?: string;
}

export interface MapResult {
  url: string;
  depth: number;
  title: string | null;
  discovery_source: string;
  submitted_url: string | null;
  final_url: string | null;
  redirect_chain: string[];
  status: string;
  reason: string | null;
  retryable: boolean;
  fetch: FetchMetadata | null;
  policy: PolicyMetadata | null;
  [key: string]: unknown;
}

export interface MapResponse extends ApiResponse {
  root_url: string;
  urls: MapResult[];
  total_discovered: number;
  max_depth_reached: number;
  latency_ms: number;
  attempted_fetch_count: number;
  failed_fetch_count: number;
  policy_exclusion_count: number;
  duplicate_count: number;
  truncated: boolean;
  termination_reasons: string[];
  policy: PolicyMetadata;
  billing: BillingSummary;
}

export interface CrawlOptions extends ApiRequestOptions {
  max_depth?: number;
  max_pages?: number;
  include_patterns?: string[];
  exclude_patterns?: string[];
  callback_url?: string;
  callback_secret?: string;
  idempotency_key?: string;
  purpose?: Purpose;
  allowed_domains?: string[];
  max_billable_units?: number;
}

export interface AcceptedLimits {
  max_depth: number;
  max_pages: number;
  allowed_domains: string[];
  robots_enforced: boolean;
  max_billable_units_interpretation: string;
  [key: string]: unknown;
}

export interface CrawlJobResponse extends ApiResponse {
  job_id: string;
  status: JobStatus;
  status_url: string;
  estimated_time_seconds: number | null;
  estimate_confidence: string;
  accepted_limits: AcceptedLimits;
  policy: PolicyMetadata;
  billing: BillingSummary;
  result_expires_at: string | null;
  job_metadata_expires_at: string | null;
  retention_policy_id: string | null;
  callback_delivery: string;
  idempotent_replay: boolean;
}

export interface JobAcceptedResponse extends ApiResponse {
  job_id: string;
  job_type: string;
  status: JobStatus;
  status_url: string;
  results_url: string | null;
  results_page_url: string | null;
  accepted_count: number;
  estimated_time_seconds: number | null;
  estimate_confidence: string;
  policy: PolicyMetadata;
  billing: BillingSummary;
  retention_policy_id: string | null;
  callback_delivery: string;
  idempotent_replay: boolean;
}

export interface JobProgress {
  unit: string;
  attempted: number;
  successful: number;
  excluded: number;
  failed: number;
  duplicates: number;
  discovered: number;
  total_known: number | null;
  remaining_estimate: number | null;
  [key: string]: unknown;
}

export interface CrawlPage {
  url: string;
  submitted_url: string | null;
  final_url: string | null;
  redirect_chain: string[];
  title: string | null;
  content: string | null;
  word_count: number;
  depth: number;
  discovery_source: string;
  status: string;
  reason: string | null;
  retryable: boolean;
  content_type: string | null;
  bytes_fetched: number;
  truncated: boolean;
  fetch: FetchMetadata | null;
  policy: PolicyMetadata | null;
  safety: SafetyMetadata | null;
  [key: string]: unknown;
}

export interface JobStatusResponse extends ApiResponse {
  job_id: string;
  status: JobStatus;
  progress: number;
  total: number;
  progress_detail: JobProgress;
  results_url: string | null;
  results_page_url: string | null;
  pages?: CrawlPage[] | null;
  error: string | null;
  created_at: string | null;
  completed_at: string | null;
  result_expires_at: string | null;
  job_metadata_expires_at: string | null;
  billing: BillingSummary;
  billing_state: string;
  retention_policy_id: string | null;
  entitlement_tier_snapshot: string | null;
  subscription_status_snapshot: string | null;
  can_cancel: boolean;
  cancellation_requested_at: string | null;
  callback_delivery: string;
}

export interface JobCancellationResponse extends ApiResponse {
  job_id: string;
  status: JobStatus;
  cancellation_requested_at: string | null;
  can_cancel: boolean;
}

export interface ApiRequestOptions {
  request_id?: string;
  signal?: AbortSignal;
}

export interface WaitForJobOptions extends ApiRequestOptions {
  timeout_ms?: number;
  poll_interval_ms?: number;
}

export interface JobResultsOptions extends ApiRequestOptions {
  limit?: number;
  cursor?: string;
}

/** Forward-compatible shape for the anticipated paginated job-results endpoint. */
export interface JobResultsPage<T = Record<string, unknown>> extends ApiResponse {
  job_id?: string;
  items?: T[];
  pages?: T[];
  urls?: T[];
  cursor?: string | null;
  next_cursor?: string | null;
  has_more?: boolean;
  [key: string]: unknown;
}

/** Current JSON document available from a completed job's presigned results_url. */
export interface JobResultDocument<T = CrawlPage> {
  pages?: T[];
  urls?: T[];
  job_type: "crawl" | "map" | string;
  status: JobStatus;
  completion_state: CompletionState;
  service_mode: ServiceMode;
  reason: string | null;
  retryable: boolean;
  truncated: boolean;
  termination_reasons: string[];
  attempted: number;
  successful: number;
  excluded: number;
  failed: number;
  duplicates: number;
  discovered: number;
  [key: string]: unknown;
}
