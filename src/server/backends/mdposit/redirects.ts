import "server-only";
import { ApiError } from "../../http/errors";
import { assertOk, buildUrl, resilientFetch, type PathSegment, type RequestOptions } from "../../http/request";
import { createTtlCache } from "../../lib/ttlCache";

// The live API answers 302 to a sibling MDposit host (docs/mdposit-contract.md). One hop is followed, https and *.mddbr.eu
// only, so the backend cannot turn this into an open proxy. Credentials are never sent (resilientFetch).
const REDIRECT_HOST = /(^|\.)mddbr\.eu$/;
const CANONICAL_TTL_MS = 10 * 60_000;

type FetchOptions = Pick<RequestOptions, "query" | "headers" | "timeoutMs" | "signal" | "retry">;

// A non-default port could reach a different service on an allowed host.
const isAllowedRedirect = (target: URL): boolean =>
  target.protocol === "https:" && target.port === "" && REDIRECT_HOST.test(target.hostname);

const badRedirect = (): ApiError => new ApiError({ kind: "http", backend: "mdposit", status: 502, code: "bad_redirect" });

const parseLocation = (location: string, base: string): URL => {
  let parsed: URL;
  try {
    parsed = new URL(location, base);
  } catch {
    throw badRedirect();
  }
  if (parsed.username !== "" || parsed.password !== "") throw badRedirect();
  return parsed;
};

const isRedirect =(response: Response): boolean => response.status >= 300 && response.status < 400;

const discard = (response: Response): void => void response.body?.cancel().catch(() => undefined);

const send = (url: string, options: FetchOptions): Promise<Response> => {
  const { timeoutMs, signal, retry } = options;
  return resilientFetch(
    "mdposit",
    "GET",
    url,
    { headers: options.headers ?? {} },
    { ...(timeoutMs !== undefined && { timeoutMs }), ...(signal && { signal }), ...(retry !== undefined && { retry }) },
  );
};

// Canonical project URL prefix ("https://host/api/rest/v1/projects/ID") keyed by the original "projects/ID", so later calls
// for the same project skip the hop. Only prefixes that passed the allow-list are stored.
const canonical = createTtlCache<string>(500);

type Target = { key: string; tail: string; query: string } | null;

// tail = everything after the project id, already percent-encoded the way buildUrl does it.
const targetOf = (path: readonly PathSegment[], options: FetchOptions): Target => {
  if (path[0] !== "projects" || path.length < 2) return null;
  const projectUrl = buildUrl("mdposit", path.slice(0, 2));
  const bare = buildUrl("mdposit", path);
  return { key: `projects/${String(path[1])}`, tail: bare.slice(projectUrl.length), query: buildUrl("mdposit", path, options.query).slice(bare.length) };
};

const remember = (target: Target, redirected: URL): void => {
  if (target === null || !redirected.pathname.endsWith(target.tail)) return;
  const projectPath = target.tail === "" ? redirected.pathname : redirected.pathname.slice(0, -target.tail.length);
  canonical.set(target.key, `${redirected.origin}${projectPath}`, CANONICAL_TTL_MS);
};

const fresh = async (path: readonly PathSegment[], options: FetchOptions, target: Target): Promise<Response> => {
  const url = buildUrl("mdposit", path, options.query);
  let response = await send(url, options);
  const location = isRedirect(response) ? response.headers.get("location") : null;
  if (location !== null) {
    discard(response);
    const redirected = parseLocation(location, url);
    if (!isAllowedRedirect(redirected)) throw badRedirect();
    response = await send(redirected.href, options);
    if (isRedirect(response)) {
      discard(response);
      throw badRedirect();
    }
    // Only a host that actually served the resource may become the canonical prefix.
    if (response.ok) remember(target, redirected);
  }
  await assertOk("mdposit", "GET", path.map(String).join("/"), response);
  return response;
};

// GET with at most one redirect hop. Returns the unconsumed 2xx Response, throws ApiError otherwise. A cache hit that answers
// 404 or redirects again means the canonical host moved: the entry is dropped and the request is retried once without it.
const fetchFollowingOneRedirect = async (path: readonly PathSegment[], options: FetchOptions = {}): Promise<Response> => {
  const target = targetOf(path, options);
  const prefix = target === null ? undefined : canonical.get(target.key);
  if (target === null || prefix === undefined) return fresh(path, options, target);

  const response = await send(`${prefix}${target.tail}${target.query}`, options);
  if (response.status !== 404 && !isRedirect(response)) {
    await assertOk("mdposit", "GET", path.map(String).join("/"), response);
    return response;
  }
  discard(response);
  // A zero TTL expires the entry at once.
  canonical.set(target.key, prefix, 0);
  return fresh(path, options, target);
};

export { fetchFollowingOneRedirect };
