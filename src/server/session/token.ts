import "server-only";
import { getToken } from "next-auth/jwt";
import type { SessionUser } from "@/entities/session";
import { sessionCookieName } from "../auth/cookie";
import { needsRefresh, refreshAccessTokenShared } from "../auth/refresh";
import type { MdrJwt } from "../auth/types";
import { getEnv } from "../config/env";
import type { CookieJar } from "./session";

const isMdrJwt = (value: Record<string, unknown>): value is MdrJwt =>
  typeof value["sub"] === "string" &&
  typeof value["accessToken"] === "string" &&
  typeof value["accessTokenExpires"] === "number" &&
  typeof value["authTime"] === "number" &&
  typeof value["lastActiveAt"] === "number";

// Absolute (8 h) and idle (2 h) limits, checked here as well as in the jwt callback: a cookie can outlive both.
const isTokenUsable = (token: MdrJwt, now: number = Date.now()): boolean => {
  if (token.error) return false;
  const env = getEnv();
  return now - token.authTime <= env.sessionTtlS * 1000 && now - token.lastActiveAt <= env.sessionIdleTtlS * 1000;
};

// Decodes the encrypted Auth.js cookie (all chunks) on the server. null = anonymous, expired or errored.
const readToken = async (jar: CookieJar, now: number = Date.now()): Promise<MdrJwt | null> => {
  const name = sessionCookieName();
  const parts = jar.getAll().filter((cookie) => cookie.name === name || cookie.name.startsWith(`${name}.`));
  if (parts.length === 0) return null;
  const cookie = parts.map((part) => `${part.name}=${encodeURIComponent(part.value)}`).join("; ");
  const decoded = await getToken({
    req: { headers: new Headers({ cookie }) },
    secret: getEnv().auth.secret,
    cookieName: name,
    salt: name,
    logger: { error: () => undefined, warn: () => undefined, debug: () => undefined },
  });
  if (!decoded || !isMdrJwt(decoded) || !isTokenUsable(decoded, now)) return null;
  return decoded;
};

const toSessionUser = (token: MdrJwt): SessionUser => ({
  id: token.sub,
  ...(token.name !== undefined && { displayName: token.name }),
  ...(token.email !== undefined && { email: token.email }),
  ...(token.username !== undefined && { username: token.username }),
});

// token: use it. expired: the IdP refused the refresh token. unavailable: IdP down and the access token is dead.
type Bearer = { kind: "token"; accessToken: string } | { kind: "expired" } | { kind: "unavailable" };

// The access token to send now. A cookie one refresh behind (the proxy refreshed during this very request) gets the
// shared refresh result instead of refreshing again. rejectedAccessToken = the backend answered 401 for it.
const bearerFor = async (token: MdrJwt, options: { rejectedAccessToken?: string } = {}, now: number = Date.now()): Promise<Bearer> => {
  const forced = options.rejectedAccessToken !== undefined;
  if (!forced && !needsRefresh(token, now)) return { kind: "token", accessToken: token.accessToken };
  const stillValid = !forced && token.accessTokenExpires > now;
  if (!token.refreshToken) return stillValid ? { kind: "token", accessToken: token.accessToken } : { kind: "expired" };
  const outcome = await refreshAccessTokenShared(token.refreshToken, options);
  if (outcome.status === "ok") return { kind: "token", accessToken: outcome.tokens.accessToken };
  if (outcome.status === "fatal") return { kind: "expired" };
  return stillValid ? { kind: "token", accessToken: token.accessToken } : { kind: "unavailable" };
};

export { bearerFor, readToken, toSessionUser };
export type { Bearer };
