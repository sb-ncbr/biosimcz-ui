import { beforeEach, describe, expect, it } from "vitest";
import { createMockBackend, type MockBackend } from "@/mocks/handlers";
import { TEST_USER } from "@/mocks/fixtures";
import { resetRefreshCache } from "@/server/auth/refresh";
import { createMemoryJar, signInJar } from "@/test/memoryJar";
import { server } from "@/test/msw";
import { setTestEnv } from "@/test/serverEnv";
import { createDraft, getMe } from "../backends/mdrepo/client";
import { readToken } from "./token";
import { withUpstream } from "./upstream";

let backend: MockBackend;

const setup = (options: Parameters<typeof createMockBackend>[0] = {}) => {
  backend = createMockBackend(options);
  server.use(...backend.handlers);
};

beforeEach(() => {
  setTestEnv();
  resetRefreshCache();
  setup();
});

describe("withUpstream", () => {
  it("sends the bearer token and returns the data", async () => {
    const jar = createMemoryJar();
    await signInJar(jar, backend.state);
    const me = await withUpstream(jar, (auth) => getMe(auth));
    expect(me.data.email).toBe(TEST_USER.email);
  });

  it("fails with an auth error without a session", async () => {
    await expect(withUpstream(createMemoryJar(), (auth) => getMe(auth))).rejects.toMatchObject({ kind: "auth", code: "no_session" });
  });

  it("refreshes proactively when the access token is about to expire and persists the rotated pair", async () => {
    const jar = createMemoryJar();
    const before = await signInJar(jar, backend.state, { accessTokenExpires: Date.now() + 10_000 });
    await withUpstream(jar, (auth) => getMe(auth));
    expect(backend.state.oidc.counters.refreshCalls).toBe(1);
    const after = await readToken(jar);
    expect(after?.refreshToken).not.toBe(before.refreshToken);
    expect(after?.accessToken).not.toBe(before.accessToken);
  });

  it("two parallel calls with one stale cookie make one IdP refresh and both succeed", async () => {
    const jar = createMemoryJar();
    await signInJar(jar, backend.state, { accessTokenExpires: Date.now() + 10_000 });
    const results = await Promise.all([withUpstream(jar, (auth) => getMe(auth)), withUpstream(jar, (auth) => getMe(auth))]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(backend.state.oidc.counters.refreshCalls).toBe(1);
  });

  it("refreshes once after a 401 and retries the call", async () => {
    const jar = createMemoryJar();
    const claims = await signInJar(jar, backend.state);
    // The IdP revoked this access token although the clock says it is fine.
    backend.state.oidc.accessTokens.get(claims.accessToken)!.revoked = true;
    const draft = await withUpstream(jar, (auth) => createDraft(auth));
    expect(draft.status).toBe(201);
    expect(backend.state.oidc.counters.refreshCalls).toBe(1);
    expect((await readToken(jar))?.accessToken).not.toBe(claims.accessToken);
  });

  it("clears the session when the second attempt is still refused", async () => {
    const jar = createMemoryJar();
    await signInJar(jar, backend.state);
    backend.state.oidc.rotate = false;
    // Every token the mock backend knows is dead, including the refreshed one.
    const originalSet = backend.state.oidc.accessTokens.set.bind(backend.state.oidc.accessTokens);
    backend.state.oidc.accessTokens.set = (key, value) => originalSet(key, { ...value, revoked: true });
    for (const token of backend.state.oidc.accessTokens.values()) token.revoked = true;
    await expect(withUpstream(jar, (auth) => createDraft(auth))).rejects.toMatchObject({ kind: "auth" });
    expect(jar.store.size).toBe(0);
  });

  it("destroys the session when the refresh token is rejected", async () => {
    const jar = createMemoryJar();
    await signInJar(jar, backend.state, { accessTokenExpires: Date.now() - 1 });
    backend.state.oidc.refreshTokens.clear();
    await expect(withUpstream(jar, (auth) => getMe(auth))).rejects.toMatchObject({ kind: "auth", code: "session_expired" });
    expect(jar.store.size).toBe(0);
  });

  it("keeps the session through an IdP outage and fails the call as unavailable only when the token is dead", async () => {
    const jar = createMemoryJar();
    await signInJar(jar, backend.state, { accessTokenExpires: Date.now() - 1 });
    backend.state.oidc.refreshFault = 503;
    await expect(withUpstream(jar, (auth) => getMe(auth))).rejects.toMatchObject({ kind: "network" });
    expect(jar.store.size).toBe(1);
  });

  it("updates the cookie at most once a minute: autosave-only activity keeps the session alive", async () => {
    const jar = createMemoryJar();
    await signInJar(jar, backend.state, { lastActiveAt: Date.now() - 5 * 60_000 });
    await withUpstream(jar, (auth) => getMe(auth));
    expect(jar.updates).toHaveLength(1);
    expect((await readToken(jar))!.lastActiveAt).toBeGreaterThan(Date.now() - 5_000);
    await withUpstream(jar, (auth) => getMe(auth));
    expect(jar.updates).toHaveLength(1);
  });

  it("does not update, refresh-persist or clear anything on a read-only jar (RSC)", async () => {
    const writable = createMemoryJar();
    await signInJar(writable, backend.state, { lastActiveAt: Date.now() - 5 * 60_000 });
    const before = [...writable.store];
    const readonly = { ...writable, writable: false };
    await withUpstream(readonly, (auth) => getMe(auth));
    expect(writable.updates).toHaveLength(0);
    expect([...writable.store]).toEqual(before);
  });

  it("a read-only jar gets a plain 401 without retry", async () => {
    const writable = createMemoryJar();
    const claims = await signInJar(writable, backend.state);
    backend.state.oidc.accessTokens.get(claims.accessToken)!.revoked = true;
    await expect(withUpstream({ ...writable, writable: false }, (auth) => getMe(auth))).rejects.toMatchObject({ kind: "auth" });
    expect(backend.state.oidc.counters.refreshCalls).toBe(0);
  });
});
