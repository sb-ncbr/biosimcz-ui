import { resetEnvCache } from "@/server/config/env";

const BASE = {
  NODE_ENV: "test",
  APP_ORIGIN: "http://localhost:3000",
  MDPOSIT_BASE_URL: "http://mdposit.test/api/rest/v1",
  MDREPO_BASE_URL: "http://mdrepo.test",
  AUTH_SECRET: "test-secret-test-secret-test-secret-0123",
  AUTH_URL: "http://localhost:3000",
  AUTH_OIDC_ISSUER: "http://idp.test/oidc/",
  AUTH_OIDC_CLIENT_ID: "mock-client",
  AUTH_OIDC_CLIENT_SECRET: "mock-client-secret",
  LOG_LEVEL: "error",
  BACKEND_TIMEOUT_MS: "2000",
};

const OPTIONAL = ["RECORDS_SOURCE", "AUTH_OIDC_SCOPE", "AUTH_OIDC_TOKEN_ENDPOINT", "SESSION_TTL_S", "SESSION_IDLE_TTL_S"];

// Replaces the server-relevant env for one test; call in beforeEach.
const setTestEnv = (overrides: Record<string, string | undefined> = {}): void => {
  for (const key of [...Object.keys(BASE), ...OPTIONAL]) delete process.env[key];
  for (const [key, value] of Object.entries({ ...BASE, ...overrides })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetEnvCache();
};

export { setTestEnv };
