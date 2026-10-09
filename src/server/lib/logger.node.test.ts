import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadEnv } from "@/server/config/env";
import { setTestEnv } from "@/test/serverEnv";
import { logger, redact } from "./logger";

describe("logger redaction", () => {
  beforeEach(() => setTestEnv({ LOG_LEVEL: "debug" }));
  afterEach(() => vi.restoreAllMocks());

  it("redacts sensitive keys at any depth", () => {
    const out = redact({
      email: "a@b.c",
      password: "hunter2",
      nested: { accessToken: "t", Authorization: "Bearer x", cookie: "s=1", csrfToken: "c", refresh_token: "r", ok: 1 },
      list: [{ sessionId: "z" }],
    });
    expect(JSON.stringify(out)).not.toMatch(/hunter2|Bearer x|"t"|"r"|"z"|s=1/);
    expect(out).toMatchObject({ email: "a@b.c", nested: { ok: 1 } });
  });

  it("never prints a password passed in the context", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    logger.info("login", { password: "hunter2", user: "jana" });
    const line = String(spy.mock.calls[0]?.[0]);
    expect(line).not.toContain("hunter2");
    expect(line).toContain("[redacted]");
  });

  it("honours LOG_LEVEL", () => {
    setTestEnv({ LOG_LEVEL: "error" });
    const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    logger.warn("hidden");
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("env validation", () => {
  const valid = {
    APP_ORIGIN: "http://localhost:3000",
    MDPOSIT_BASE_URL: "http://m.test/api/rest/v1/",
    MDREPO_BASE_URL: "http://r.test/",
    AUTH_SECRET: "x".repeat(32),
    AUTH_URL: "http://localhost:3000",
    AUTH_OIDC_ISSUER: "http://idp.test/oidc",
    AUTH_OIDC_CLIENT_ID: "client",
    AUTH_OIDC_CLIENT_SECRET: "client-secret",
  };
  const production = { ...valid, NODE_ENV: "production", APP_ORIGIN: "https://mdrepo.example", AUTH_URL: "https://mdrepo.example", AUTH_OIDC_ISSUER: "https://login.e-infra.cz/oidc/" };

  it("applies defaults, trims trailing slashes and gives the issuer exactly one", () => {
    const env = loadEnv(valid);
    expect(env.mdrepoBaseUrl).toBe("http://r.test");
    expect(env.mdpositBaseUrl).toBe("http://m.test/api/rest/v1");
    expect(env.auth.issuer).toBe("http://idp.test/oidc/");
    expect(env.sessionTtlS).toBe(28_800);
    expect(env.sessionIdleTtlS).toBe(7_200);
    expect(env.sessionCookie.name).toBe("mdr.session-token");
  });

  it("names the failing keys but never their values", () => {
    expect(() => loadEnv({ ...valid, AUTH_SECRET: "short-secret-value" })).toThrow(/AUTH_SECRET/);
    expect(() => loadEnv({ ...valid, AUTH_SECRET: "short-secret-value" })).not.toThrow(/short-secret-value/);
    expect(() => loadEnv({ ...valid, AUTH_OIDC_CLIENT_ID: undefined })).toThrow(/AUTH_OIDC_CLIENT_ID/);
  });

  it("accepts a complete production configuration with a __Host- cookie", () => {
    expect(loadEnv(production).sessionCookie).toEqual({ name: "__Host-mdr.session-token", secure: true });
  });

  it("rejects an http issuer, a missing secret and a foreign AUTH_URL in production", () => {
    expect(() => loadEnv({ ...production, AUTH_OIDC_ISSUER: "http://login.example/oidc/" })).toThrow(/AUTH_OIDC_ISSUER/);
    expect(() => loadEnv({ ...production, AUTH_SECRET: undefined })).toThrow(/AUTH_SECRET/);
    expect(() => loadEnv({ ...production, AUTH_URL: "https://other.example" })).toThrow(/AUTH_URL/);
  });
});
