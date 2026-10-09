import "server-only";
import type { z } from "zod";
import { getEnv } from "../config/env";
import { logger } from "../lib/logger";
import { ApiError, fromResponseBody, type Backend } from "./errors";

type PathSegment = string | number;
type QueryValue = string | number | boolean | undefined | readonly string[];

type RetryPolicy = { retries: number; baseDelayMs: number };

type RequestOptions = {
  query?: Record<string, QueryValue>;
  // Plain object or array only; serialised as JSON with a Content-Type.
  json?: unknown;
  // FormData, streams and binary bodies pass through untouched (no Content-Type is invented).
  body?: BodyInit | null;
  headers?: Record<string, string>;
  // null disables the timeout (uploads).
  timeoutMs?: number | null;
  signal?: AbortSignal;
  retry?: RetryPolicy | false;
  onResponse?: (response: { status: number; headers: Headers }) => void;
};

type HttpResult<T> = { data: T; status: number; headers: Headers };

const DEFAULT_RETRY: RetryPolicy = { retries: 2, baseDelayMs: 200 };
const IDEMPOTENT = new Set(["GET", "HEAD", "PUT", "DELETE", "OPTIONS"]);
const RETRYABLE_STATUS = new Set([502, 503, 504]);

// encodeURIComponent leaves "." and ".." intact, which URL normalisation would treat as traversal.
const encodeSegment = (segment: PathSegment): string => {
  const text = String(segment);
  if (text === "." || text === "..") return text.replaceAll(".", "%2E");
  return encodeURIComponent(text);
};

const baseUrlFor = (backend: Backend): string => {
  const env = getEnv();
  return backend === "mdposit" ? env.mdpositBaseUrl : env.mdrepoBaseUrl;
};

const buildUrl = (backend: Backend, path: readonly PathSegment[], query?: Record<string, QueryValue>): string => {
  const url = `${baseUrlFor(backend)}/${path.map(encodeSegment).join("/")}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    if (typeof value === "object") for (const item of value) params.append(key, item);
    else params.append(key, String(value));
  }
  const text = params.toString();
  return text ? `${url}?${text}` : url;
};

const isPlainJson = (value: unknown): boolean => {
  if (Array.isArray(value)) return true;
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
};

// Not awaited: cancelling can stall on some transports and the body is not needed.
const discard = (response: Response): void => {
  response.body?.cancel().catch(() => undefined);
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const delayFor = (attempt: number, policy: RetryPolicy): number => policy.baseDelayMs * 2 ** attempt * (0.5 + Math.random());

const isStream = (body: unknown): boolean => typeof ReadableStream !== "undefined" && body instanceof ReadableStream;

// Timeout, retry and transport-error normalisation shared by request() and the generated MDposit client.
const resilientFetch = async (
  backend: Backend,
  method: string,
  url: string,
  init: RequestInit,
  options: Pick<RequestOptions, "timeoutMs" | "signal" | "retry">,
): Promise<Response> => {
  const timeoutMs = options.timeoutMs === undefined ? getEnv().backendTimeoutMs : options.timeoutMs;
  const policy = options.retry === false ? undefined : (options.retry ?? DEFAULT_RETRY);
  // A consumed stream cannot be replayed.
  const retries = policy !== undefined && IDEMPOTENT.has(method) && !isStream(init.body) ? policy.retries : 0;

  for (let attempt = 0; ; attempt++) {
    const signals = [options.signal, timeoutMs === null ? undefined : AbortSignal.timeout(timeoutMs)].filter(
      (signal): signal is AbortSignal => signal !== undefined,
    );
    const signal = signals.length > 0 ? AbortSignal.any(signals) : undefined;
    const retriesLeft = policy !== undefined && attempt < retries;
    try {
      const response = await fetch(url, { ...init, method, signal, redirect: "manual", cache: "no-store", credentials: "omit" });
      if (retriesLeft && RETRYABLE_STATUS.has(response.status)) {
        discard(response);
        await sleep(delayFor(attempt, policy));
        continue;
      }
      return response;
    } catch (cause) {
      const name = cause instanceof Error ? cause.name : "";
      if (name === "TimeoutError") throw new ApiError({ kind: "timeout", backend, cause });
      if (name === "AbortError") throw new ApiError({ kind: "network", backend, code: "aborted", cause });
      if (retriesLeft) {
        await sleep(delayFor(attempt, policy));
        continue;
      }
      throw new ApiError({ kind: "network", backend, cause });
    }
  }
};

const failFromResponse = async (backend: Backend, response: Response): Promise<ApiError> => {
  const body: unknown = await response.json().catch(() => undefined);
  return fromResponseBody(backend, response.status, body);
};

// Turns any non-2xx response (opaque 3xx included, redirects are never followed with credentials) into an ApiError.
const assertOk = async (backend: Backend, method: string, path: string, response: Response): Promise<void> => {
  if (response.ok) return;
  const error = await failFromResponse(backend, response);
  logger.warn("upstream request failed", { backend, method, path, status: response.status, kind: error.kind });
  throw error;
};

// Returns the unconsumed Response for 2xx (streaming passthrough); throws ApiError otherwise.
const requestRaw = async (
  backend: Backend,
  method: string,
  path: readonly PathSegment[],
  options: RequestOptions = {},
): Promise<Response> => {
  const headers = new Headers(options.headers);
  let body: BodyInit | null | undefined = options.body;
  if (options.json !== undefined) {
    if (!isPlainJson(options.json)) throw new TypeError("json option must be a plain object or array");
    body = JSON.stringify(options.json);
    headers.set("Content-Type", "application/json");
  }
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  const init: RequestInit & { duplex?: "half" } = { headers, body };
  if (isStream(body)) init.duplex = "half";

  const response = await resilientFetch(backend, method, buildUrl(backend, path, options.query), init, options);
  options.onResponse?.({ status: response.status, headers: response.headers });
  await assertOk(backend, method, path.map(String).join("/"), response);
  return response;
};

const parseJson = async <T>(backend: Backend, response: Response, schema: z.ZodType<T>): Promise<T> => {
  const json: unknown = await response.json().catch(() => undefined);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    logger.error("upstream response failed schema validation", {
      backend,
      issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), code: issue.code, message: issue.message })),
    });
    throw new ApiError({ kind: "schema", backend });
  }
  return parsed.data;
};

const request = async <T>(
  backend: Backend,
  method: string,
  path: readonly PathSegment[],
  schema: z.ZodType<T>,
  options: RequestOptions = {},
): Promise<HttpResult<T>> => {
  const response = await requestRaw(backend, method, path, options);
  return { data: await parseJson(backend, response, schema), status: response.status, headers: response.headers };
};

// For endpoints whose success body is empty or ignored (204, upload steps).
const requestVoid = async (
  backend: Backend,
  method: string,
  path: readonly PathSegment[],
  options: RequestOptions = {},
): Promise<{ status: number; headers: Headers }> => {
  const response = await requestRaw(backend, method, path, options);
  discard(response);
  return { status: response.status, headers: response.headers };
};

export { assertOk, buildUrl, request, requestRaw, requestVoid, resilientFetch };
export type { PathSegment, RequestOptions };
