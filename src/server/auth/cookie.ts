import "server-only";
import { getEnv } from "../config/env";

type SessionCookieOptions = { httpOnly: true; secure: boolean; sameSite: "lax"; path: "/" };

// Kept outside config.ts so readers of the cookie (token.ts, proxy) need no Auth.js runtime.
const sessionCookieName = (): string => getEnv().sessionCookie.name;

const sessionCookieOptions = (): SessionCookieOptions => ({
  httpOnly: true,
  secure: getEnv().sessionCookie.secure,
  sameSite: "lax",
  path: "/",
});

export { sessionCookieName, sessionCookieOptions };
