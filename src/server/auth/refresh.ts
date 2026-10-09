import "server-only";
import { createHash } from "node:crypto";
import { getEnv } from "../config/env";
import { logger } from "../lib/logger";
import type { MdrJwt } from "./types";

const REFRESH_MARGIN_MS = 60_000;
const REFRESH_REUSE_MS = 30_000;
const REQUEST_TIMEOUT_MS = 10_000;

type RefreshedTokens = { accessToken: string; accessTokenExpires: number; refreshToken?: string; idToken?: string };

// fatal: the IdP refused the refresh token (session is over). transient: network, timeout or 5xx (keep the old token).
type RefreshOutcome = { status: "ok"; tokens: RefreshedTokens } | { status: "fatal" } | { status: "transient" };

type Entry = { startedAt: number; result: Promise<RefreshOutcome> };

// On globalThis so the proxy, route handlers and actions (separate bundles, one process) share one map.
const g = globalThis as typeof globalThis & { __mdrRecentRefreshes?: Map<string, Entry> };
const recent = (): Map<string, Entry> => (g.__mdrRecentRefreshes ??= new Map());

const keyOf = (refreshToken: string): string => createHash("sha256").update(refreshToken).digest("hex");

const tokenEndpoint = (): string => getEnv().auth.tokenEndpoint ?? `${getEnv().auth.issuer}token`;

const parseTokens = (body: unknown): RefreshedTokens | null => {
  if (typeof body !== "object" || body === null) return null;
  const data = body as Record<string, unknown>;
  if (typeof data["access_token"] !== "string" || data["access_token"].length === 0) return null;
  const expiresIn = typeof data["expires_in"] === "number" ? data["expires_in"] : 3600;
  return {
    accessToken: data["access_token"],
    accessTokenExpires: Date.now() + expiresIn * 1000,
    ...(typeof data["refresh_token"] === "string" && { refreshToken: data["refresh_token"] }),
    ...(typeof data["id_token"] === "string" && { idToken: data["id_token"] }),
  };
};

// Only { code } is logged: never tokens, claims or error objects.
const refreshAccessToken = async (refreshToken: string): Promise<RefreshOutcome> => {
  const { clientId, clientSecret } = getEnv().auth;
  const basic = Buffer.from(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`).toString("base64");
  try {
    const response = await fetch(tokenEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basic}`, Accept: "application/json" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.ok) {
      const tokens = parseTokens(await response.json().catch(() => null));
      if (tokens) return { status: "ok", tokens };
      logger.warn("token refresh failed", { code: "bad_response" });
      return { status: "transient" };
    }
    if (response.status === 400 || response.status === 401) {
      logger.warn("token refresh failed", { code: `http_${response.status}` });
      return { status: "fatal" };
    }
    logger.warn("token refresh failed", { code: `http_${response.status}` });
    return { status: "transient" };
  } catch (error) {
    logger.warn("token refresh failed", { code: error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network" });
    return { status: "transient" };
  }
};

type SharedOptions = {
  // The access token a backend just rejected: a cached result carrying it must not be reused.
  rejectedAccessToken?: string;
};

// One IdP call per refresh token per 30 s: the IdP invalidates earlier access tokens on refresh, so parallel refreshes
// would leave some cookie holding a dead token. A request whose cookie is one refresh stale gets the same new tokens.
const refreshAccessTokenShared = async (refreshToken: string, options: SharedOptions = {}): Promise<RefreshOutcome> => {
  const map = recent();
  const now = Date.now();
  for (const [key, entry] of map) if (now - entry.startedAt > REFRESH_REUSE_MS) map.delete(key);
  const key = keyOf(refreshToken);
  const existing = map.get(key);
  if (existing && options.rejectedAccessToken !== undefined) {
    const outcome = await existing.result;
    if (outcome.status === "ok" && outcome.tokens.accessToken === options.rejectedAccessToken && map.get(key) === existing) map.delete(key);
    else if (map.get(key) === existing) return outcome;
  } else if (existing) {
    return existing.result;
  }
  const entry: Entry = { startedAt: now, result: refreshAccessToken(refreshToken) };
  map.set(key, entry);
  const outcome = await entry.result;
  // A transient failure must not block retries for 30 s.
  if (outcome.status === "transient" && map.get(key) === entry) map.delete(key);
  return outcome;
};

const needsRefresh = (token: Pick<MdrJwt, "accessTokenExpires">, now: number = Date.now()): boolean =>
  now >= token.accessTokenExpires - REFRESH_MARGIN_MS;

// Folds an outcome into the token. transient keeps the token unchanged and without an error.
const applyRefresh = (token: MdrJwt, outcome: RefreshOutcome): MdrJwt => {
  if (outcome.status === "transient") return token;
  if (outcome.status === "fatal") return { ...token, error: "RefreshAccessTokenError" };
  const next = { ...token };
  delete next.error;
  return {
    ...next,
    accessToken: outcome.tokens.accessToken,
    accessTokenExpires: outcome.tokens.accessTokenExpires,
    refreshToken: outcome.tokens.refreshToken ?? token.refreshToken,
    idToken: outcome.tokens.idToken ?? token.idToken,
  };
};

const resetRefreshCache = (): void => {
  recent().clear();
};

export { applyRefresh, needsRefresh, refreshAccessTokenShared, resetRefreshCache };
export type { RefreshOutcome };
