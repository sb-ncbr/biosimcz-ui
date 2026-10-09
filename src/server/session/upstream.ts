import "server-only";
import { sessionCookieName } from "../auth/cookie";
import { needsRefresh } from "../auth/refresh";
import { TOUCH_INTERVAL_MS } from "../auth/callbacks";
import { ApiError, isApiError } from "../http/errors";
import type { CookieJar } from "./session";
import { bearerFor, readToken } from "./token";
import type { UpstreamAuth } from "./types";

// Deletes the Auth.js cookie and its chunks (only possible on a writable jar).
const clearSessionCookies = (jar: CookieJar): void => {
  if (!jar.writable) return;
  const name = sessionCookieName();
  for (const cookie of jar.getAll()) if (cookie.name === name || cookie.name.startsWith(`${name}.`)) jar.delete(cookie.name);
};

const sessionExpired = (): ApiError => new ApiError({ kind: "auth", backend: "mdrepo", code: "session_expired" });

const authFor = (accessToken: string): UpstreamAuth => ({ headers: { Authorization: `Bearer ${accessToken}` } });

// Runs an MDRepo call with the session's bearer token. Proactive refresh and activity updates persist through jar.update
// (writable jars: actions, route handlers); one forced refresh and retry follows a 401. RSC (read-only) never writes.
const withUpstream = async <T>(jar: CookieJar, call: (auth: UpstreamAuth) => Promise<T>): Promise<T> => {
  let token = await readToken(jar);
  if (!token) throw new ApiError({ kind: "auth", backend: "mdrepo", code: "no_session" });

  // Autosave-only activity keeps the session alive: the update re-issues the cookie with a fresh activity time.
  if (jar.writable && (needsRefresh(token) || Date.now() - token.lastActiveAt > TOUCH_INTERVAL_MS)) {
    await jar.update({}).catch(() => undefined);
    token = await readToken(jar);
    if (!token) {
      clearSessionCookies(jar);
      throw sessionExpired();
    }
  }

  const bearer = await bearerFor(token);
  if (bearer.kind === "expired") {
    clearSessionCookies(jar);
    throw sessionExpired();
  }
  if (bearer.kind === "unavailable") throw new ApiError({ kind: "network", backend: "mdrepo", code: "idp_unavailable" });

  try {
    return await call(authFor(bearer.accessToken));
  } catch (error) {
    if (!isApiError(error) || error.kind !== "auth" || !jar.writable) throw error;
    const forced = await bearerFor(token, { rejectedAccessToken: bearer.accessToken });
    if (forced.kind === "expired") {
      clearSessionCookies(jar);
      throw error;
    }
    if (forced.kind === "unavailable") throw error;
    await jar.update({ refresh: true }).catch(() => undefined);
    try {
      return await call(authFor(forced.accessToken));
    } catch (retryError) {
      if (isApiError(retryError) && retryError.kind === "auth") clearSessionCookies(jar);
      throw retryError;
    }
  }
};

export { withUpstream };
