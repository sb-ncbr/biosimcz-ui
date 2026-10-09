import { randomBytes } from "node:crypto";
import { defineConfig } from "@playwright/test";

// Defaults match APP_ORIGIN in .env.local (the BFF origin check rejects any other origin). Override with E2E_PORT and
// E2E_MOCK_PORT when 3000 or 9090 are taken; E2E_DIST_DIR keeps the test server's build apart from a running `next dev`.
const PORT = Number(process.env["E2E_PORT"] ?? 3000);
const MOCK_PORT = Number(process.env["E2E_MOCK_PORT"] ?? 9090);
const ORIGIN = `http://localhost:${PORT}`;
const DIST_DIR = process.env["E2E_DIST_DIR"];
// Reusing a server on a custom port could silently test someone else's app against a real backend.
const reuse = !process.env["CI"] && process.env["E2E_PORT"] === undefined;

// Specs read these (auth.spec.ts, support/mockIdp.ts); workers inherit them because they load this file too.
process.env["E2E_ORIGIN"] = ORIGIN;
process.env["MOCK_IDP_URL"] = `http://localhost:${MOCK_PORT}/oidc`;

// Local mock IdP only (npm run mock). The secret is generated per run; nothing here is a real credential.
const MOCK_CLIENT = { MOCK_OIDC_CLIENT_ID: "mock-client", MOCK_OIDC_CLIENT_SECRET: "mock-client-secret" };
const authEnv = {
  APP_ORIGIN: ORIGIN,
  AUTH_URL: ORIGIN,
  AUTH_SECRET: randomBytes(32).toString("base64"),
  AUTH_OIDC_ISSUER: `http://localhost:${MOCK_PORT}/oidc/`,
  AUTH_OIDC_CLIENT_ID: MOCK_CLIENT.MOCK_OIDC_CLIENT_ID,
  AUTH_OIDC_CLIENT_SECRET: MOCK_CLIENT.MOCK_OIDC_CLIENT_SECRET,
  MDPOSIT_BASE_URL: `http://localhost:${MOCK_PORT}/api/rest/v1`,
  MDREPO_BASE_URL: `http://localhost:${MOCK_PORT}`,
  ...(DIST_DIR && { NEXT_DIST_DIR: DIST_DIR }),
};

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 90_000,
  webServer: [
    {
      command: "npm run mock",
      port: MOCK_PORT,
      reuseExistingServer: reuse,
      timeout: 60_000,
      env: { MOCK_PORT: String(MOCK_PORT), ...MOCK_CLIENT },
    },
    {
      command: `npx next dev -p ${PORT}`,
      url: `${ORIGIN}/healthz`,
      reuseExistingServer: reuse,
      timeout: 120_000,
      env: authEnv,
    },
  ],
  use: { baseURL: ORIGIN },
  projects: [
    { name: "phone-375", use: { viewport: { width: 375, height: 812 } } },
    { name: "phone-390", use: { viewport: { width: 390, height: 844 } } },
    { name: "tablet-768", use: { viewport: { width: 768, height: 1024 } } },
    { name: "desktop-1280", use: { viewport: { width: 1280, height: 800 } } },
    { name: "desktop-1440", use: { viewport: { width: 1440, height: 900 } } },
  ],
});
