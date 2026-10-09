import { readFileSync } from "node:fs";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { server } from "@/test/msw";
import { setTestEnv } from "@/test/serverEnv";
import { jwtCallback, redirectCallback, sessionCallback } from "./callbacks";
import { resetRefreshCache } from "./refresh";
import type { MdrJwt } from "./types";

const HOUR = 3_600_000;
const NOW = 1_800_000_000_000;

const account = { providerAccountId: "101", access_token: "acc-1", refresh_token: "ref-1", id_token: "id-1", expires_at: Math.floor(NOW / 1000) + 900 };

const live: MdrJwt = {
  sub: "101",
  name: "Jana Novakova",
  email: "depositor@example.org",
  username: "101",
  accessToken: "acc-1",
  accessTokenExpires: NOW + 600_000,
  refreshToken: "ref-1",
  idToken: "id-1",
  authTime: NOW - HOUR,
  lastActiveAt: NOW - 10_000,
};

let refreshCalls: number;

beforeEach(() => {
  setTestEnv();
  resetRefreshCache();
  refreshCalls = 0;
  server.use(
    http.post("http://idp.test/oidc/token", () => {
      refreshCalls++;
      return HttpResponse.json({ access_token: "acc-2", expires_in: 900, refresh_token: "ref-2" });
    }),
  );
});

describe("jwt callback: sign-in", () => {
  it("stores tokens, expiry, authTime and lastActiveAt, and keeps only profile claims", async () => {
    const token = await jwtCallback(
      { token: { sub: "random-uuid", name: "Jana Novakova", email: "depositor@example.org", picture: "x" }, user: { id: "random-uuid", username: "101" }, account, trigger: "signIn" },
      NOW,
    );
    expect(token).toEqual({
      sub: "101",
      name: "Jana Novakova",
      email: "depositor@example.org",
      username: "101",
      accessToken: "acc-1",
      accessTokenExpires: account.expires_at * 1000,
      refreshToken: "ref-1",
      idToken: "id-1",
      authTime: NOW,
      lastActiveAt: NOW,
    });
  });

  it("takes the identity from the IdP subject, not from the random id Auth.js assigns", async () => {
    const token = await jwtCallback({ token: { sub: "random-uuid" }, user: { id: "random-uuid" }, account }, NOW);
    expect(token).toMatchObject({ sub: "101" });
  });

  it("falls back to expires_in and refuses an account without an access token", async () => {
    const token = await jwtCallback({ token: { sub: "u" }, account: { providerAccountId: "101", access_token: "a", expires_in: 100 } }, NOW);
    expect(token).toMatchObject({ accessTokenExpires: NOW + 100_000 });
    expect(await jwtCallback({ token: { sub: "u" }, account: { providerAccountId: "101", refresh_token: "r" } }, NOW)).toBeNull();
  });
});

describe("jwt callback: later reads", () => {
  it("returns the token untouched inside the throttle window and does not refresh", async () => {
    const token = await jwtCallback({ token: { ...live } }, NOW);
    expect(token).toEqual(live);
    expect(refreshCalls).toBe(0);
  });

  it("moves lastActiveAt at most once a minute", async () => {
    const stale = { ...live, lastActiveAt: NOW - 61_000 };
    expect(await jwtCallback({ token: { ...stale } }, NOW)).toMatchObject({ lastActiveAt: NOW });
  });

  it("refreshes inside the 60 s margin and stores the rotated pair", async () => {
    const token = await jwtCallback({ token: { ...live, accessTokenExpires: NOW + 30_000 } }, NOW);
    expect(token).toMatchObject({ accessToken: "acc-2", refreshToken: "ref-2" });
    expect(refreshCalls).toBe(1);
  });

  it("forces a refresh on update with { refresh: true } only", async () => {
    await jwtCallback({ token: { ...live }, trigger: "update", session: {} }, NOW);
    expect(refreshCalls).toBe(0);
    await jwtCallback({ token: { ...live }, trigger: "update", session: { refresh: "yes" } }, NOW);
    expect(refreshCalls).toBe(0);
    expect(await jwtCallback({ token: { ...live }, trigger: "update", session: { refresh: true } }, NOW)).toMatchObject({ accessToken: "acc-2" });
    expect(refreshCalls).toBe(1);
  });

  it("flags a refused refresh token but keeps the identity", async () => {
    server.use(http.post("http://idp.test/oidc/token", () => HttpResponse.json({ error: "invalid_grant" }, { status: 400 })));
    const token = await jwtCallback({ token: { ...live, accessTokenExpires: NOW - 1 } }, NOW);
    expect(token).toMatchObject({ error: "RefreshAccessTokenError", sub: "101" });
  });

  it("ends the session after 8 h absolute, even with recent activity", async () => {
    expect(await jwtCallback({ token: { ...live, authTime: NOW - 8 * HOUR - 1 } }, NOW)).toBeNull();
    expect(await jwtCallback({ token: { ...live, authTime: NOW - 8 * HOUR + 1000 } }, NOW)).not.toBeNull();
  });

  it("ends the session after 2 h idle", async () => {
    expect(await jwtCallback({ token: { ...live, lastActiveAt: NOW - 2 * HOUR - 1 } }, NOW)).toBeNull();
    expect(await jwtCallback({ token: { ...live, lastActiveAt: NOW - 2 * HOUR + 1000 } }, NOW)).not.toBeNull();
  });

  it("ends a session whose cookie lacks our claims", async () => {
    expect(await jwtCallback({ token: { sub: "101" } }, NOW)).toBeNull();
  });
});

describe("session callback", () => {
  it("returns identity only: no accessToken, refreshToken, idToken or expiry fields", () => {
    const session = sessionCallback({ session: { expires: "2026-10-01T12:00:00.000Z" }, token: { ...live } });
    expect(Object.keys(session).sort()).toEqual(["expires", "user"]);
    expect(Object.keys(session.user).sort()).toEqual(["email", "id", "name", "username"]);
    expect(JSON.stringify(session)).not.toMatch(/acc-1|ref-1|id-1|accessToken|refreshToken|idToken/);
  });

  it("surfaces only the error flag of a failed refresh", () => {
    const session = sessionCallback({ session: { expires: "x" }, token: { ...live, error: "RefreshAccessTokenError" } });
    expect(session).toMatchObject({ error: "RefreshAccessTokenError" });
    expect(Object.keys(session).sort()).toEqual(["error", "expires", "user"]);
  });
});

describe("redirect callback", () => {
  const base = "http://localhost:3000";

  it("keeps same-origin paths", () => {
    expect(redirectCallback({ url: "/depositions/abc/system", baseUrl: base })).toBe(`${base}/depositions/abc/system`);
    expect(redirectCallback({ url: `${base}/depositions?page=2`, baseUrl: base })).toBe(`${base}/depositions?page=2`);
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "https://localhost:3000.evil.example/x"])(
    "sends %s to the home page",
    (url) => {
      expect(redirectCallback({ url, baseUrl: base })).toBe(`${base}/`);
    },
  );
});

describe("provider checks", () => {
  // createAuthConfig is private and Auth.js builds the provider lazily, so the source is the stable place to pin this.
  it("requires pkce, state and nonce", () => {
    const source = readFileSync(new URL("./config.ts", import.meta.url), "utf8");
    expect(source).toContain('checks: ["pkce", "state", "nonce"]');
  });
});
