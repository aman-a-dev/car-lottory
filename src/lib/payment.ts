/**
 * links.et integration — Ethiopian payment receipt verification.
 * Docs: https://links.et/agents.md | https://links.et/llms-full.txt
 *
 * Requires LINKS_ET_API_KEY in the environment. Server-side only — never
 * call this from the browser, and never log a receipt URL/reference.
 */

const BASE_URL = "https://links.et";

function getApiKey(): string {
  const key = process.env.LINKS_ET_API_KEY;
  if (!key) {
    throw new Error("LINKS_ET_API_KEY environment variable is not set");
  }
  return key;
}

// ---------- Response envelope ----------

export type ProviderSource =
  | "telebirr-html"
  | "cbe-pdf"
  | "mb-json"
  | "cbebirr-pdf"
  | "boa-json"
  | "zemen-pdf"
  | "awash-html"
  | "dashen-pdf"
  | "dashen-html"
  | "mpesa-pdf"
  | "ebirr-html"
  | "amhara-json"
  | "abay-html"
  | "berhan-pdf"
  | "oromia-pdf"
  | "ahadu-pdf"
  | "siinqee-pdf"
  | "zamzam-json"
  | "hulubeje-dxxrdv";

export interface VerifyReceipt {
  source: ProviderSource;
  [key: string]: unknown; // fields differ per provider — see /docs/verify.md
}

export interface VerifySuccess {
  ok: true;
  providerKey: string;
  resolvedUrl: string;
  httpStatus: number;
  fetchedAt: string;
  rawHtmlLength: number;
  error: null;
  receipt: VerifyReceipt;
}

export type LinksEtErrorCode =
  | "invalid_json"
  | "invalid_request"
  | "not_an_image"
  | "missing_key"
  | "invalid_key"
  | "revoked_key"
  | "rate_limited"
  | "quota_exceeded"
  | "image_cap_reached"
  | "ocr_daily_cap_reached"
  | "ai_not_configured"
  | string; // the "no upstream status" / 502 cases carry no fixed code

export interface VerifyErrorBody {
  ok: false;
  error: {
    code: LinksEtErrorCode;
    message: string;
    detected?: string; // present on not_an_image
    used?: number; // present on quota_exceeded
    cap?: number; // present on quota_exceeded
  };
  receipt?: VerifyReceipt; // partial receipt may be present on 502
}

export interface VerifyQueued {
  processingStatus: "queued";
  requestId: string;
  statusUrl: string;
  eventsUrl: string;
}

export type VerifyResult = VerifySuccess | VerifyQueued;

export class LinksEtError extends Error {
  code: LinksEtErrorCode;
  httpStatus: number;
  retryable: boolean;
  retryAfterMs?: number;
  detected?: string;
  used?: number;
  cap?: number;
  partialReceipt?: VerifyReceipt;

  constructor(
    httpStatus: number,
    body: VerifyErrorBody | null,
    retryAfterHeader: string | null
  ) {
    const code = body?.error?.code ?? "unknown_error";
    const message = body?.error?.message ?? `links.et request failed with HTTP ${httpStatus}`;
    super(message);
    this.name = "LinksEtError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.detected = body?.error?.detected;
    this.used = body?.error?.used;
    this.cap = body?.error?.cap;
    this.partialReceipt = body?.receipt;
    this.retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : undefined;
    this.retryable = classifyRetryable(httpStatus, code);
  }
}

/**
 * Retry rules, per the errors table in agents.md:
 * - 400 invalid_json / invalid_request / not_an_image → not retryable (fix the request)
 * - 400 with no code (no upstream status) → retryable with backoff
 * - 401 missing_key / invalid_key / revoked_key → not retryable (mint a new key)
 * - 429 rate_limited → retryable after Retry-After
 * - 429 quota_exceeded / image_cap_reached → not retryable (no useful timer)
 * - 429 ocr_daily_cap_reached → retryable later (service-wide budget)
 * - 502 (no fixed code) → retryable, 1-2s with jitter
 * - 503 ai_not_configured → not retryable
 */
function classifyRetryable(httpStatus: number, code: LinksEtErrorCode): boolean {
  if (httpStatus === 400) {
    return !["invalid_json", "invalid_request", "not_an_image"].includes(code);
  }
  if (httpStatus === 401) return false;
  if (httpStatus === 429) {
    if (code === "rate_limited" || code === "ocr_daily_cap_reached") return true;
    return false; // quota_exceeded, image_cap_reached
  }
  if (httpStatus === 502) return true;
  if (httpStatus === 503) return false;
  return false;
}

// ---------- Low-level request helper ----------

async function linksEtFetch(path: string, body: unknown, idempotencyKey?: string): Promise<Response> {
  const headers: Record<string, string> = {
    "x-api-key": getApiKey(),
    "content-type": "application/json",
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  return fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

async function parseVerifyResponse(res: Response): Promise<VerifyResult> {
  // 202 = queued (only happens when waitMs is sent and the bank hasn't answered yet)
  if (res.status === 202) {
    return (await res.json()) as VerifyQueued;
  }

  const retryAfter = res.headers.get("Retry-After");

  if (!res.ok) {
    let parsedBody: VerifyErrorBody | null = null;
    try {
      parsedBody = await res.json();
    } catch {
      // no JSON body (shouldn't normally happen, but don't crash on it)
    }
    throw new LinksEtError(res.status, parsedBody, retryAfter);
  }

  return (await res.json()) as VerifySuccess;
}

// ---------- POST /api/verify ----------

export interface VerifyByUrlOptions {
  url: string;
  waitMs?: number; // clamped to 30000 by the API
  idempotencyKey?: string;
}

export interface VerifyByReferenceOptions {
  reference: string; // telebirr only
  waitMs?: number;
  idempotencyKey?: string;
}

export type VerifyOptions = VerifyByUrlOptions | VerifyByReferenceOptions;

/**
 * Verify a single receipt by URL or (telebirr-only) reference.
 * Synchronous by default — can hold the connection open for a while on an
 * uncached receipt against a busy bank. Pass waitMs to get a 202 + requestId
 * back early instead, then use pollVerifyStatus / the events URL.
 */
export async function verifyReceipt(options: VerifyOptions): Promise<VerifyResult> {
  const { waitMs, idempotencyKey } = options

  if ("url" in options && "reference" in options) {
    throw new Error("Pass exactly one of url or reference, not both")
  }

  // `in` narrows the union so only the matching field is read.
  const body: Record<string, unknown> =
    "url" in options
      ? { url: options.url }
      : { reference: options.reference }

  if (waitMs !== undefined) body.waitMs = Math.min(waitMs, 30000)

  const res = await linksEtFetch("/api/verify", body, idempotencyKey)
  return parseVerifyResponse(res)
}

/** Poll the status of a queued (202) verification by its requestId. */
export async function pollVerifyStatus(requestId: string): Promise<VerifyResult> {
  const res = await fetch(`${BASE_URL}/api/verify/${requestId}`, {
    headers: { "x-api-key": getApiKey() },
  });
  return parseVerifyResponse(res);
}

/**
 * Subscribe to the server-sent events stream for a queued verification.
 * Replays the last event for ~5 minutes, so a result that landed just before
 * you connect is not lost. Falls back to polling is the caller's job if the
 * connection drops (see verifyAndWait below for a combined helper).
 */
export function openVerifyEventStream(requestId: string): EventSource {
  const url = new URL(`${BASE_URL}/api/verify/${requestId}/events`);
  url.searchParams.set("x-api-key", getApiKey()); // SSE endpoint accepts the key as a query param
  return new EventSource(url.toString());
}

/**
 * Convenience helper implementing the pattern the docs recommend:
 * submit with a short waitMs, and on 202 poll once a second until resolved.
 * (Simple and dependency-free; use openVerifyEventStream instead if you want SSE.)
 */
export async function verifyAndWait(
  options: VerifyOptions,
  pollIntervalMs = 1000,
  maxWaitMs = 120000
): Promise<VerifySuccess> {
  const first = await verifyReceipt({ ...options, waitMs: 2000 } as VerifyOptions);

  if ("ok" in first) return first;

  const { requestId } = first;
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    const result = await pollVerifyStatus(requestId);
    if ("ok" in result) return result;
  }

  throw new Error(`Verification ${requestId} did not resolve within ${maxWaitMs}ms`);
}

// ---------- POST /api/verify-image ----------

export interface VerifyImageInput {
  imageBase64: string; // base64 JPEG or PNG, max 5MB per image
}

export interface VerifyImageOptions {
  images: VerifyImageInput[]; // up to 5 images of the same transaction
  idempotencyKey?: string;
}

export interface VerifyImageUpstream {
  provider?: string;
  reference?: string;
  confidence?: number;
  result?: {
    receipt?: VerifyReceipt;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface VerifyImageSuccess {
  ok: true;
  upstream: VerifyImageUpstream;
  [key: string]: unknown;
}

/**
 * Verify a receipt from one or more screenshots. The AI detector's output
 * (provider/reference/confidence) is NOT itself trustworthy — only
 * result.upstream.result.receipt is a verified bank receipt.
 */
export async function verifyReceiptImage(options: VerifyImageOptions): Promise<VerifyImageSuccess> {
  const { images, idempotencyKey } = options;
  if (images.length < 1 || images.length > 5) {
    throw new Error("verifyReceiptImage accepts 1 to 5 images of the same transaction");
  }

  const body = images.length === 1 ? { imageBase64: images[0].imageBase64 } : { images };

  const res = await linksEtFetch("/api/verify-image", body, idempotencyKey);

  if (!res.ok) {
    let parsedBody: VerifyErrorBody | null = null;
    try {
      parsedBody = await res.json();
    } catch {
      // ignore
    }
    throw new LinksEtError(res.status, parsedBody, res.headers.get("Retry-After"));
  }

  return (await res.json()) as VerifyImageSuccess;
}

/** Extracts the verified receipt from a verify-image response — never trust the detector fields. */
export function getVerifiedReceiptFromImageResult(result: VerifyImageSuccess): VerifyReceipt | undefined {
  return result.upstream?.result?.receipt;
}

// ---------- Health ----------

export async function getLinksEtHealth(): Promise<{ ok: boolean; ts: string }> {
  const res = await fetch(`${BASE_URL}/api/verify`);
  return res.json();
}

export async function getLinksEtStatus(): Promise<unknown> {
  // Returns 503 when overall status is down — caller should still read the body.
  const res = await fetch(`${BASE_URL}/api/status`);
  return res.json();
}

// ---------- Simple retry wrapper ----------

/**
 * Wraps a call to verifyReceipt with the retry rules from agents.md:
 * - rate_limited / 502 / "no upstream status" 400s are retried with backoff
 * - quota_exceeded, bad request, auth errors, Siinqee links are never retried here
 * Note: never pass a Siinqee receipt URL into a retry loop — those receipts
 * allow only ~5 views total, and a retry destroys it for everyone. Check
 * `providerKey`/`receipt.source` before retrying, or just don't retry Siinqee.
 */
export async function verifyReceiptWithRetry(
  options: VerifyOptions,
  maxAttempts = 3
): Promise<VerifyResult> {
  let lastError: LinksEtError | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await verifyReceipt(options);
    } catch (err) {
      if (!(err instanceof LinksEtError) || !err.retryable || attempt === maxAttempts) {
        throw err;
      }
      lastError = err;
      const backoffMs = err.retryAfterMs ?? Math.min(1000 * 2 ** (attempt - 1), 20000) + Math.random() * 500;
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }

  // Unreachable, but keeps TypeScript happy.
  throw lastError ?? new Error("verifyReceiptWithRetry failed with no error captured");
}
