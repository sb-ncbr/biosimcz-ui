import { createMiddleware } from "@mswjs/http-middleware";
import express from "express";
import { createMockBackend } from "./handlers";
import { seedMyDepositionsDemo } from "./handlers/myDepositions";

// Standalone mock of MDposit, MDRepo and the e-INFRA OIDC IdP (npm run mock). Point MDPOSIT_BASE_URL and
// MDREPO_BASE_URL at it, and AUTH_OIDC_ISSUER at http://localhost:<port>/oidc/ with the MOCK_OIDC_CLIENT_* credentials.
const port = Number(process.env["MOCK_PORT"] ?? 9090);
const accessTtl = process.env["MOCK_OIDC_ACCESS_TTL_S"] ? Number(process.env["MOCK_OIDC_ACCESS_TTL_S"]) : undefined;
const clientId = process.env["MOCK_OIDC_CLIENT_ID"];
const clientSecret = process.env["MOCK_OIDC_CLIENT_SECRET"];

const { handlers, state } = createMockBackend({
  ...(accessTtl !== undefined && { oidcAccessTtlS: accessTtl }),
  ...(clientId && { oidcClientId: clientId }),
  ...(clientSecret && { oidcClientSecret: clientSecret }),
});
seedMyDepositionsDemo(state);

const app = express();
app.use(createMiddleware(...handlers));
app.listen(port, () => {
  console.log(`mock backend and OIDC IdP on http://localhost:${port}`);
});
