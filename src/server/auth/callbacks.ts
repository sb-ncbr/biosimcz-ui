import "server-only";
import { safeNext } from "@/entities/session";
import { getEnv } from "../config/env";
import { applyRefresh, needsRefresh, refreshAccessTokenShared } from "./refresh";
import type { MdrJwt, SessionError } from "./types";

// A session read re-issues the cookie; lastActiveAt moves at most this often.
const TOUCH_INTERVAL_MS = 60_000;

type AccountLike = {
  // The IdP subject (e-INFRA id). Auth.js replaces token.sub with a random UUID, so this is the stable identity.
  providerAccountId?: string | undefined;
  access_token?: string | undefined;
  refresh_token?: string | undefined;
  id_token?: string | undefined;
  expires_at?: number | undefined;
  expires_in?: number | undefined;
};

type JwtParams = {
  token: Record<string, unknown>;
  user?: { id?: string | undefined; username?: string | undefined } | undefined;
  account?: AccountLike | null | undefined;
  trigger?: "signIn" | "signUp" | "update" | undefined;
  // The payload of unstable_update(); only { refresh: true } is honoured.
  session?: unknown;
};

const isMdrJwt = (token: Record<string, unknown>): token is MdrJwt =>
  typeof token["sub"] === "string" &&
  typeof token["accessToken"] === "string" &&
  typeof token["accessTokenExpires"] === "number" &&
  typeof token["authTime"] === "number" &&
  typeof token["lastActiveAt"] === "number";

const isString = (value: unknown): value is string => typeof value === "string";

const wantsRefresh = (session: unknown): boolean =>
  typeof session === "object" && session !== null && (session as Record<string, unknown>)["refresh"] === true;

// null signs the user out (Auth.js clears the cookie chunks).
const jwtCallback = async ({ token, user, account, trigger, session }: JwtParams, now: number = Date.now()): Promise<Record<string, unknown> | null> => {
  if (account) {
    if (!account.access_token) return null;
    const accessTokenExpires = account.expires_at ? account.expires_at * 1000 : now + (account.expires_in ?? 3600) * 1000;
    const sub = account.providerAccountId ?? user?.id;
    if (!sub) return null;
    const fresh: MdrJwt = {
      sub,
      accessToken: account.access_token,
      accessTokenExpires,
      authTime: now,
      lastActiveAt: now,
      ...(isString(token["name"]) && { name: token["name"] }),
      ...(isString(token["email"]) && { email: token["email"] }),
      ...(user?.username !== undefined && { username: user.username }),
      ...(account.refresh_token !== undefined && { refreshToken: account.refresh_token }),
      ...(account.id_token !== undefined && { idToken: account.id_token }),
    };
    return fresh;
  }

  if (!isMdrJwt(token)) return null;
  const env = getEnv();
  if (now - token.authTime > env.sessionTtlS * 1000) return null;
  if (now - token.lastActiveAt > env.sessionIdleTtlS * 1000) return null;
  if (token.error) return token;

  const touched = now - token.lastActiveAt > TOUCH_INTERVAL_MS ? { ...token, lastActiveAt: now } : token;
  const force = trigger === "update" && wantsRefresh(session);
  if (!touched.refreshToken || (!force && !needsRefresh(touched, now))) return touched;
  return applyRefresh(touched, await refreshAccessTokenShared(touched.refreshToken));
};

type SessionParams = { session: { expires?: unknown }; token: Record<string, unknown> };

// Identity only. Tokens stay in the cookie and are read server-side through server/session/token.ts.
const sessionCallback = ({ session, token }: SessionParams) => {
  const error: SessionError | undefined = token["error"] === "RefreshAccessTokenError" ? "RefreshAccessTokenError" : undefined;
  return {
    user: {
      id: isString(token["sub"]) ? token["sub"] : "",
      ...(isString(token["name"]) && { name: token["name"] }),
      ...(isString(token["email"]) && { email: token["email"] }),
      ...(isString(token["username"]) && { username: token["username"] }),
    },
    expires: session.expires,
    ...(error && { error }),
  };
};

// Only a same-origin path survives; everything else lands on "/".
const redirectCallback = ({ url, baseUrl }: { url: string; baseUrl: string }): string => {
  try {
    const base = new URL(baseUrl);
    const parsed = new URL(url, base);
    if (parsed.origin !== base.origin) return `${base.origin}/`;
    return `${base.origin}${safeNext(`${parsed.pathname}${parsed.search}${parsed.hash}`)}`;
  } catch {
    return `${baseUrl}/`;
  }
};

export { jwtCallback, redirectCallback, sessionCallback, TOUCH_INTERVAL_MS };
