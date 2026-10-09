import { decode, encode } from "next-auth/jwt";
import { TEST_USER } from "@/mocks/fixtures";
import { mintMockTokens } from "@/mocks/handlers/oidc";
import type { MockState } from "@/mocks/handlers/state";
import { jwtCallback } from "@/server/auth/callbacks";
import { sessionCookieName } from "@/server/auth/cookie";
import type { MdrJwt } from "@/server/auth/types";
import { getEnv } from "@/server/config/env";
import type { CookieJar, SessionUpdate } from "@/server/session/session";

type MemoryJar = CookieJar & { store: Map<string, string>; updates: SessionUpdate[] };

// The Auth.js cookie as the browser would hold it, minted with the real encode() (as the e2e helper of the reference app does).
const encodeSession = async (token: MdrJwt): Promise<string> => {
  const salt = sessionCookieName();
  return encode({ token: { ...token }, secret: getEnv().auth.secret, salt, maxAge: getEnv().sessionIdleTtlS });
};

// Tokens come from the mock IdP state, so the mock backend accepts them. Overrides replace any claim (timestamps, error ...).
const mintSessionToken = (state: MockState, overrides: Partial<MdrJwt> = {}): MdrJwt => {
  const tokens = mintMockTokens(state);
  const now = Date.now();
  return {
    sub: TEST_USER.id,
    name: TEST_USER.displayName,
    email: TEST_USER.email,
    username: TEST_USER.id,
    accessToken: tokens.access,
    accessTokenExpires: now + state.oidc.accessTtlS * 1000,
    refreshToken: tokens.refresh,
    idToken: "mock-id-token",
    authTime: now,
    lastActiveAt: now,
    ...overrides,
  };
};

const createMemoryJar = (writable = true): MemoryJar => {
  const store = new Map<string, string>();
  const updates: SessionUpdate[] = [];
  const jar: MemoryJar = {
    store,
    updates,
    writable,
    get: (name) => store.get(name),
    getAll: () => [...store].map(([name, value]) => ({ name, value })),
    delete: (name) => {
      store.delete(name);
    },
    // Same as unstable_update in production: run the real jwt callback on the cookie and write the result back.
    update: async (data) => {
      updates.push(data);
      const name = sessionCookieName();
      const raw = store.get(name);
      if (!raw) return;
      const payload = await decode({ token: raw, secret: getEnv().auth.secret, salt: name });
      if (!payload) return;
      const next = await jwtCallback({ token: payload, trigger: "update", session: data });
      if (next === null) store.delete(name);
      else store.set(name, await encodeSession(next as MdrJwt));
    },
  };
  return jar;
};

// Signs the jar in with fresh mock IdP tokens and returns the claims that were stored.
const signInJar = async (jar: MemoryJar, state: MockState, overrides: Partial<MdrJwt> = {}): Promise<MdrJwt> => {
  const token = mintSessionToken(state, overrides);
  jar.store.set(sessionCookieName(), await encodeSession(token));
  return token;
};

export { createMemoryJar, encodeSession, mintSessionToken, signInJar };
export type { MemoryJar };
