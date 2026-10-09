import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { createMockBackend } from "@/mocks/handlers";
import { proxy } from "@/proxy";
import { sessionCookieName } from "@/server/auth/cookie";
import { resetRefreshCache } from "@/server/auth/refresh";
import { encodeSession, mintSessionToken } from "@/test/memoryJar";
import { server } from "@/test/msw";
import { setTestEnv } from "@/test/serverEnv";

const ORIGIN = "http://localhost:3000";
const HOUR = 3_600_000;

const backend = () => createMockBackend();
let state = backend().state;

beforeEach(() => {
  setTestEnv();
  resetRefreshCache();
  const mock = backend();
  state = mock.state;
  server.use(...mock.handlers);
});

type Cookies = Record<string, string>;

const call = (path: string, cookies: Cookies = {}) => {
  const request = new NextRequest(`${ORIGIN}${path}`);
  for (const [name, value] of Object.entries(cookies)) request.cookies.set(name, value);
  return { request, response: proxy(request, {} as never) };
};

const signedIn = async (overrides = {}): Promise<Cookies> => ({ [sessionCookieName()]: await encodeSession(mintSessionToken(state, overrides)) });

const headers = (response: Response) => ({
  nosniff: response.headers.get("x-content-type-options"),
  frame: response.headers.get("content-security-policy"),
});

const cleared = (response: Response): string[] =>
  response.headers
    .getSetCookie()
    .filter((line) => /max-age=0/i.test(line))
    .map((line) => line.split("=")[0]!);

const PUBLIC = ["/", "/records", "/records/abc", "/communities", "/communities/biosim-cz", "/login", "/login?next=%2Fdepositions", "/dev/primitives"];
const PROTECTED = [
  "/depositions",
  "/depositions/abc/system",
  "/depositions/abc/study",
  "/depositions/abc/published",
  "/communities/new",
  "/communities/biosim-cz/edit",
];

describe("proxy route table", () => {
  it.each(PUBLIC)("lets anonymous users through %s", async (path) => {
    const { response } = call(path);
    const result = await response;
    expect(result.status).toBe(200);
    expect(result.headers.get("location")).toBeNull();
    expect(headers(result)).toEqual({ nosniff: "nosniff", frame: "frame-ancestors 'none'" });
  });

  it.each(PROTECTED)("redirects anonymous users from %s to /login with next", async (path) => {
    const result = await call(path).response;
    expect(result.status).toBe(307);
    expect(result.headers.get("location")).toBe(`${ORIGIN}/login?next=${encodeURIComponent(path)}`);
    expect(headers(result)).toEqual({ nosniff: "nosniff", frame: "frame-ancestors 'none'" });
  });

  it.each(PROTECTED)("lets a signed-in user through %s", async (path) => {
    const result = await call(path, await signedIn()).response;
    expect(result.status).toBe(200);
    expect(result.headers.get("location")).toBeNull();
    expect(headers(result).nosniff).toBe("nosniff");
  });

  it("keeps the query string in next", async () => {
    const result = await call("/depositions?page=2").response;
    expect(result.headers.get("location")).toBe(`${ORIGIN}/login?next=%2Fdepositions%3Fpage%3D2`);
  });

  it("does not match the Auth.js, BFF, health and asset paths", async () => {
    const { config } = await import("@/proxy");
    const pattern = new RegExp(`^${config.matcher[0]}$`);
    for (const path of ["/api/auth/session", "/api/auth/callback/einfracz", "/bff/depositions", "/healthz", "/_next/static/x.js", "/favicon.ico"]) {
      expect(pattern.test(path), path).toBe(false);
    }
    for (const path of ["/", "/login", "/depositions/abc"]) expect(pattern.test(path), path).toBe(true);
  });
});

describe("proxy session limits", () => {
  it("redirects a protected route once the session is idle-expired and clears the cookie", async () => {
    const cookies = await signedIn({ lastActiveAt: Date.now() - 3 * HOUR });
    const result = await call("/depositions", cookies).response;
    expect(result.status).toBe(307);
    expect(result.headers.get("location")).toContain("/login?next=");
    expect(cleared(result)).toContain(sessionCookieName());
  });

  it("redirects after 8 h absolute even when the user was active a second ago", async () => {
    const cookies = await signedIn({ authTime: Date.now() - 9 * HOUR });
    expect((await call("/depositions", cookies).response).status).toBe(307);
  });

  it("treats a refresh error as anonymous on protected routes", async () => {
    const cookies = await signedIn({ error: "RefreshAccessTokenError" });
    const result = await call("/depositions", cookies).response;
    expect(result.status).toBe(307);
    expect(cleared(result)).toContain(sessionCookieName());
  });

  it("redirects a protected route with an undecodable cookie and clears it with its attributes", async () => {
    const result = await call("/depositions?page=2", { [sessionCookieName()]: "garbage" }).response;
    expect(result.headers.get("location")).toBe(`${ORIGIN}/login?next=%2Fdepositions%3Fpage%3D2`);
    expect(cleared(result)).toContain(sessionCookieName());
    expect(result.headers.get("set-cookie")).toMatch(/Path=\//);
  });

  it("re-issues the cookie of an active session (activity slides the idle limit)", async () => {
    const cookies = await signedIn({ lastActiveAt: Date.now() - 5 * 60_000 });
    const result = await call("/depositions", cookies).response;
    expect(result.status).toBe(200);
    expect(result.headers.getSetCookie().some((line) => line.startsWith(`${sessionCookieName()}=`) && !/max-age=0/i.test(line))).toBe(true);
  });

  it("refreshes a token near expiry before the render (one IdP call)", async () => {
    const cookies = await signedIn({ accessTokenExpires: Date.now() + 10_000 });
    await call("/depositions", cookies).response;
    expect(state.oidc.counters.refreshCalls).toBe(1);
  });
});

describe("proxy stale sessions (no /login loop)", () => {
  it("clears every cookie chunk on /login?expired and lands on a clean /login?next=", async () => {
    const name = sessionCookieName();
    const result = await call("/login?next=%2Fdepositions&expired=1", { [name]: "a", [`${name}.0`]: "b", [`${name}.1`]: "c", other: "keep" }).response;
    expect(result.status).toBe(307);
    expect(result.headers.get("location")).toBe(`${ORIGIN}/login?next=%2Fdepositions`);
    expect([...new Set(cleared(result))].sort()).toEqual([name, `${name}.0`, `${name}.1`].sort());
    expect(headers(result).nosniff).toBe("nosniff");
  });

  it("does not loop: a clean /login passes without a redirect", async () => {
    const result = await call("/login?next=%2Fdepositions").response;
    expect(result.headers.get("location")).toBeNull();
  });
});

describe("proxy security headers and environment", () => {
  it("adds HSTS only on https origins", async () => {
    expect((await call("/").response).headers.get("strict-transport-security")).toBeNull();
    setTestEnv({ APP_ORIGIN: "https://mdrepo.example", AUTH_URL: "https://mdrepo.example" });
    const secure = await call("/").response;
    expect(secure.headers.get("strict-transport-security")).toContain("max-age=");
  });

  it("answers 500 naming only keys when the environment is broken", async () => {
    setTestEnv({ AUTH_SECRET: "short-secret-value" });
    const result = await call("/").response;
    expect(result.status).toBe(500);
    const text = await result.text();
    expect(text).toContain("AUTH_SECRET");
    expect(text).not.toContain("short-secret-value");
  });
});
