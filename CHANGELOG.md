# Changelog

All notable changes to `veriq-sdk` (Node.js) are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

> **Beta:** the Veriq API and this SDK are in beta. Interfaces may change between minor
> versions until 1.0.

## [0.2.0] - 2026-10-04 (beta)

First public release on npm as `veriq-sdk`.

### Added

- `VeriqClient` (ESM, TypeScript types included) built on the platform `fetch`, with an
  optional custom `fetch` implementation.
- `search()` with optional generated answer (`include_answer`) and result limits.
- `extract()` for one or more URLs, `map()` for site URL discovery, and `crawl()` for
  asynchronous crawl jobs.
- Job helpers: `getJob()`, `cancelJob()`, and `waitForJob()`.
- Error hierarchy: `VeriqError`, `VeriqApiError`, `VeriqNetworkError`,
  `VeriqResponseError`, and `VeriqJobTimeoutError`.
- Configurable timeout (`timeoutMs`), bounded retries (`maxRetries`, `maxRetryDelayMs`), and a
  response size cap (`maxResponseBytes`). Idempotency keys make writes safe to retry.
- `verifyWebhookSignature()` for HMAC-signed webhook deliveries, with timestamp tolerance.
- Node.js 20 or later.
- CI type-checks, builds, smoke-tests the built package, and runs `npm pack --dry-run` on
  Node.js 20, 22, and 24.

[0.2.0]: https://github.com/ecolyt-ai/veriq-sdk-node/releases/tag/v0.2.0
