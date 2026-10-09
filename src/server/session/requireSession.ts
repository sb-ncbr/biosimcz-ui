import "server-only";
import { ApiError } from "../http/errors";
import type { CookieJar, Session } from "./session";
import { readToken, toSessionUser } from "./token";

// Throws an auth ApiError; route handlers, actions and repositories use this (page guards live in pageGuard.ts).
const requireSession = async (jar: CookieJar): Promise<Session> => {
  const token = await readToken(jar);
  if (!token) throw new ApiError({ kind: "auth", backend: "mdrepo", code: "no_session" });
  return { user: toSessionUser(token) };
};

export { requireSession };
