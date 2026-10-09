import { beforeEach, describe, expect, it } from "vitest";
import { createMockBackend, type MockBackend } from "@/mocks/handlers";
import { resetRefreshCache } from "@/server/auth/refresh";
import { sessionCookieName } from "@/server/auth/cookie";
import { createMemoryJar, encodeSession, mintSessionToken, signInJar } from "@/test/memoryJar";
import { server } from "@/test/msw";
import { setTestEnv } from "@/test/serverEnv";
import { bearerFor, readToken, toSessionUser } from "./token";

const HOUR = 3_600_000;
let backend: MockBackend;

beforeEach(() => {
  setTestEnv();
  resetRefreshCache();
  backend = createMockBackend();
  server.use(...backend.handlers);
});

describe("readToken", () => {
  it("decodes the cookie and ignores everything that is not ours", async () => {
    const jar = createMemoryJar();
    expect(await readToken(jar)).toBeNull();
    const claims = await signInJar(jar, backend.state);
    expect(await readToken(jar)).toMatchObject({ sub: claims.sub, accessToken: claims.accessToken });
    jar.store.set(sessionCookieName(), "garbage");
    expect(await readToken(jar)).toBeNull();
  });

  it("reassembles a chunked cookie", async () => {
    const jar = createMemoryJar();
    const claims = mintSessionToken(backend.state);
    const value = await encodeSession(claims);
    const middle = Math.floor(value.length / 2);
    const name = sessionCookieName();
    jar.store.set(`${name}.0`, value.slice(0, middle));
    jar.store.set(`${name}.1`, value.slice(middle));
    expect(await readToken(jar)).toMatchObject({ sub: claims.sub });
  });

  it("refuses a session past 8 h absolute or 2 h idle, and one with a refresh error", async () => {
    const now = Date.now();
    for (const overrides of [
      { authTime: now - 8 * HOUR - 1000 },
      { lastActiveAt: now - 2 * HOUR - 1000 },
      { error: "RefreshAccessTokenError" as const },
    ]) {
      const jar = createMemoryJar();
      await signInJar(jar, backend.state, overrides);
      expect(await readToken(jar)).toBeNull();
    }
  });

  it("maps to a session user without tokens", async () => {
    const jar = createMemoryJar();
    const token = await signInJar(jar, backend.state);
    const user = toSessionUser(token);
    expect(user).toEqual({ id: "101", displayName: "Jana Novakova", email: "depositor@example.org", username: "101" });
    expect(JSON.stringify(user)).not.toContain(token.accessToken);
  });
});

describe("bearerFor", () => {
  it("returns the cookie token while it is fresh", async () => {
    const token = mintSessionToken(backend.state);
    expect(await bearerFor(token)).toEqual({ kind: "token", accessToken: token.accessToken });
    expect(backend.state.oidc.counters.refreshCalls).toBe(0);
  });

  it("refreshes near expiry; a second reader with the stale cookie gets the same new token (one IdP call)", async () => {
    const stale = mintSessionToken(backend.state, { accessTokenExpires: Date.now() + 10_000 });
    const first = await bearerFor(stale);
    const second = await bearerFor(stale);
    expect(first.kind).toBe("token");
    expect(first).toEqual(second);
    expect(first).not.toEqual({ kind: "token", accessToken: stale.accessToken });
    expect(backend.state.oidc.counters.refreshCalls).toBe(1);
  });

  it("gives no bearer when the refresh token is refused or missing", async () => {
    const refused = mintSessionToken(backend.state, { accessTokenExpires: Date.now() - 1 });
    backend.state.oidc.refreshTokens.get(refused.refreshToken!)!.active = false;
    expect(await bearerFor(refused)).toEqual({ kind: "expired" });
    const noRefresh = mintSessionToken(backend.state, { accessTokenExpires: Date.now() - 1 });
    delete noRefresh.refreshToken;
    expect(await bearerFor(noRefresh)).toEqual({ kind: "expired" });
  });

  it("keeps a still-valid token through an IdP outage but reports unavailable once it is dead", async () => {
    backend.state.oidc.refreshFault = 503;
    const valid = mintSessionToken(backend.state, { accessTokenExpires: Date.now() + 10_000 });
    expect(await bearerFor(valid)).toEqual({ kind: "token", accessToken: valid.accessToken });
    resetRefreshCache();
    const dead = mintSessionToken(backend.state, { accessTokenExpires: Date.now() - 1 });
    expect(await bearerFor(dead)).toEqual({ kind: "unavailable" });
  });
});
