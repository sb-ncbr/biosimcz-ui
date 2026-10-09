import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw";
import { setTestEnv } from "@/test/serverEnv";
import { applyRefresh, needsRefresh, refreshAccessTokenShared, resetRefreshCache } from "./refresh";
import type { MdrJwt } from "./types";

const TOKEN_URL = "http://idp.test/oidc/token";

let calls: { refresh: string | null; authorization: string | null }[];

const answer = (build: (call: number) => Response | Promise<Response>) =>
  server.use(
    http.post(TOKEN_URL, async ({ request }) => {
      const form = new URLSearchParams(await request.text());
      calls.push({ refresh: form.get("refresh_token"), authorization: request.headers.get("authorization") });
      return build(calls.length);
    }),
  );

const ok = (access: string, extra: Record<string, unknown> = {}) =>
  HttpResponse.json({ access_token: access, expires_in: 900, refresh_token: `r-${access}`, ...extra });

const base: MdrJwt = {
  sub: "101",
  accessToken: "old-access",
  accessTokenExpires: Date.now() + 1000,
  refreshToken: "old-refresh",
  authTime: Date.now(),
  lastActiveAt: Date.now(),
};

beforeEach(() => {
  setTestEnv();
  resetRefreshCache();
  calls = [];
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("needsRefresh", () => {
  it("uses a 60 s margin", () => {
    const now = 1_000_000;
    expect(needsRefresh({ accessTokenExpires: now + 61_000 }, now)).toBe(false);
    expect(needsRefresh({ accessTokenExpires: now + 60_000 }, now)).toBe(true);
    expect(needsRefresh({ accessTokenExpires: now - 1 }, now)).toBe(true);
  });
});

describe("refreshAccessTokenShared", () => {
  it("sends one form-encoded request with client_secret_basic", async () => {
    answer(() => ok("a1"));
    const outcome = await refreshAccessTokenShared("rt-1");
    expect(outcome).toMatchObject({ status: "ok", tokens: { accessToken: "a1", refreshToken: "r-a1" } });
    expect(calls).toEqual([{ refresh: "rt-1", authorization: `Basic ${Buffer.from("mock-client:mock-client-secret").toString("base64")}` }]);
  });

  it("collapses two parallel calls into one token request", async () => {
    answer(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return ok("a1");
    });
    const [first, second] = await Promise.all([refreshAccessTokenShared("rt-1"), refreshAccessTokenShared("rt-1")]);
    expect(calls).toHaveLength(1);
    expect(first).toEqual(second);
  });

  it("reuses the result for 30 s and calls again after that", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T10:00:00Z"));
    answer((call) => ok(`a${call}`));
    await refreshAccessTokenShared("rt-1");
    vi.setSystemTime(new Date("2026-10-01T10:00:29Z"));
    expect(await refreshAccessTokenShared("rt-1")).toMatchObject({ tokens: { accessToken: "a1" } });
    expect(calls).toHaveLength(1);
    vi.setSystemTime(new Date("2026-10-01T10:00:31Z"));
    expect(await refreshAccessTokenShared("rt-1")).toMatchObject({ tokens: { accessToken: "a2" } });
    expect(calls).toHaveLength(2);
  });

  it("does not reuse a result the backend just rejected", async () => {
    answer((call) => ok(`a${call}`));
    await refreshAccessTokenShared("rt-1");
    const again = await refreshAccessTokenShared("rt-1", { rejectedAccessToken: "a1" });
    expect(again).toMatchObject({ tokens: { accessToken: "a2" } });
    // An unrelated rejected token still gets the cached result.
    expect(await refreshAccessTokenShared("rt-1", { rejectedAccessToken: "something-else" })).toMatchObject({ tokens: { accessToken: "a2" } });
    expect(calls).toHaveLength(2);
  });

  it("keeps the old refresh token when the response has none", async () => {
    answer(() => HttpResponse.json({ access_token: "a1", expires_in: 900 }));
    const outcome = await refreshAccessTokenShared("rt-1");
    expect(applyRefresh(base, outcome)).toMatchObject({ accessToken: "a1", refreshToken: "old-refresh" });
  });

  it("marks invalid_grant (400) and 401 as fatal", async () => {
    answer(() => HttpResponse.json({ error: "invalid_grant" }, { status: 400 }));
    const outcome = await refreshAccessTokenShared("rt-1");
    expect(outcome).toEqual({ status: "fatal" });
    expect(applyRefresh(base, outcome)).toMatchObject({ error: "RefreshAccessTokenError", accessToken: "old-access" });
    resetRefreshCache();
    answer(() => HttpResponse.json({}, { status: 401 }));
    expect(await refreshAccessTokenShared("rt-2")).toEqual({ status: "fatal" });
  });

  it("treats 5xx and network errors as transient: token unchanged, no error, retried next time", async () => {
    answer(() => HttpResponse.json({}, { status: 503 }));
    const outcome = await refreshAccessTokenShared("rt-1");
    expect(outcome).toEqual({ status: "transient" });
    expect(applyRefresh(base, outcome)).toBe(base);
    answer(() => HttpResponse.error());
    expect(await refreshAccessTokenShared("rt-1")).toEqual({ status: "transient" });
    expect(calls).toHaveLength(2);
  });

  it("clears the error flag after a successful refresh", async () => {
    answer(() => ok("a1"));
    const outcome = await refreshAccessTokenShared("rt-1");
    expect(applyRefresh({ ...base, error: "RefreshAccessTokenError" }, outcome).error).toBeUndefined();
  });

  it("logs nothing but a code", async () => {
    setTestEnv({ LOG_LEVEL: "debug" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    answer(() => HttpResponse.json({ error: "invalid_grant", error_description: "secret-detail" }, { status: 400 }));
    await refreshAccessTokenShared("rt-secret-value");
    const logged = warn.mock.calls.map((call) => String(call[0])).join("\n");
    expect(JSON.parse(logged)).toMatchObject({ message: "token refresh failed", code: "http_400" });
    expect(logged).not.toMatch(/rt-secret-value|secret-detail|mock-client-secret/);
  });
});
