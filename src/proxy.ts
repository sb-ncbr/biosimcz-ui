import { NextResponse, type NextRequest } from "next/server";
import { EXPIRED_PARAM, isProtectedPath, LOGIN_PATH, loginHref } from "@/entities/session";
import { auth } from "@/server/auth/config";
import { sessionCookieName, sessionCookieOptions } from "@/server/auth/cookie";
import { getEnv } from "@/server/config/env";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": "frame-ancestors 'none'",
};

const withHeaders = (response: NextResponse): NextResponse => {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(name, value);
  if (getEnv().appOrigin.startsWith("https:")) response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  return response;
};

// The session cookie is chunked by Auth.js (name, name.0, name.1 ...): every part present on the request is cleared,
// with the attributes it was set with (browsers ignore a __Host- deletion that lacks Secure and Path=/).
const clearSessionCookies = (request: NextRequest, response: NextResponse): NextResponse => {
  const name = sessionCookieName();
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name === name || cookie.name.startsWith(`${name}.`)) response.cookies.set(cookie.name, "", { ...sessionCookieOptions(), maxAge: 0 });
  }
  return response;
};

// Anonymous redirect for protected routes. Auth.js runs the jwt callback first (refresh, activity, limits) and appends
// the re-issued cookie to whatever this handler returns; a null session also gets its cookie chunks cleared there.
// The lazy NextAuth form makes auth(wrapper) asynchronous: it resolves to the actual handler.
const handlerFor = auth((request) => {
  const { pathname, search } = request.nextUrl;

  const signedIn = Boolean(request.auth) && request.auth?.error === undefined;
  if (!signedIn && isProtectedPath(pathname)) {
    return withHeaders(clearSessionCookies(request, NextResponse.redirect(new URL(loginHref(pathname + search), request.url))));
  }
  return withHeaders(NextResponse.next());
});

// Skips all /_next paths (assets, HMR websocket), favicon, the health probe and the Auth.js endpoints (they own their
// cookies); /bff handlers enforce their own auth and origin checks. The config export must be inline and static.
export const config = {
  matcher: ["/((?!_next/|favicon.ico|healthz|bff|api/auth).*)"],
};

// The backend rejected this session during a render: clear it once and land on a clean /login?next=...
// Runs before Auth.js, whose wrapper would append a re-issued session cookie after our deletion.
const expiredLogin = (request: NextRequest): NextResponse | null => {
  const { pathname, searchParams } = request.nextUrl;
  if (pathname !== LOGIN_PATH || !searchParams.has(EXPIRED_PARAM)) return null;
  return withHeaders(clearSessionCookies(request, NextResponse.redirect(new URL(loginHref(searchParams.get("next") ?? "/"), request.url))));
};

// A bad environment yields a clear 500 instead of an uncaught error; the message names keys only, never values.
const proxy = async (request: NextRequest, event: Parameters<Awaited<typeof handlerFor>>[1]): Promise<Response> => {
  try {
    getEnv();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Invalid environment configuration";
    return new NextResponse(`Server misconfigured. ${detail}`, { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  const expired = expiredLogin(request);
  if (expired) return expired;
  const handler = await handlerFor;
  return (await handler(request, event)) ?? withHeaders(NextResponse.next());
};

export { proxy };
