import { createHash } from "node:crypto";
import { HttpResponse, http, type HttpHandler } from "msw";
import { TEST_USER } from "../fixtures";
import { getKeys, signIdToken } from "../oidc/keys";
import { nextId, type MockState } from "./state";

// Mock e-INFRA CZ IdP (plan 7.3). Issuer is the request origin plus /oidc/ (trailing slash, like the real one).
const issuerOf = (request: Request): string => `${new URL(request.url).origin}/oidc/`;

const ID_TOKEN_TTL_S = 300;

const claims = () => ({
  sub: TEST_USER.id,
  given_name: TEST_USER.givenName,
  family_name: TEST_USER.familyName,
  name: TEST_USER.displayName,
  email: TEST_USER.email,
});

const sha256Base64Url = (value: string): string => createHash("sha256").update(value).digest("base64url");

const redirect = (location: string): Response => new Response(null, { status: 302, headers: { Location: location } });

const escapeHtml = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const html = (title: string, body: string, status = 200): Response =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title></head><body><main><h1>${title}</h1>${body}</main></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

const oauthError = (status: number, error: string) => HttpResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

const basicCredentials = (request: Request): { id: string; secret: string } | null => {
  const header = /^Basic (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!header) return null;
  const [id = "", ...rest] = Buffer.from(header, "base64").toString("utf8").split(":");
  return { id: decodeURIComponent(id), secret: decodeURIComponent(rest.join(":")) };
};

const clientAuthorised = (state: MockState, request: Request): boolean => {
  const credentials = basicCredentials(request);
  return credentials?.id === state.options.oidcClientId && credentials.secret === state.options.oidcClientSecret;
};

// Rotation on (default): every refresh answers a new refresh token and retires the old one. Either way the earlier
// access tokens of the grant die, like on the real IdP.
const issueTokens = (state: MockState, family?: string) => {
  const { oidc } = state;
  const access = nextId(state, "acc");
  const keep = family !== undefined && !oidc.rotate;
  const refresh = keep ? family : nextId(state, "ref");
  if (family !== undefined) {
    const previous = oidc.refreshTokens.get(family);
    if (previous && !keep) previous.active = false;
    for (const token of oidc.accessTokens.values()) if (token.refresh === family) token.revoked = true;
  }
  oidc.accessTokens.set(access, { refresh, expiresAt: Date.now() + oidc.accessTtlS * 1000, revoked: false });
  if (!keep) oidc.refreshTokens.set(refresh, { active: true, expiresAt: Date.now() + oidc.refreshTtlS * 1000 });
  oidc.issued.push(access);
  if (!keep) oidc.issued.push(refresh);
  return { access, refresh };
};

type AuthorizeParams = { clientId: string; redirectUri: string; state: string; challenge: string | undefined; scope: string; nonce: string | undefined };

const readAuthorize = (params: URLSearchParams): AuthorizeParams => ({
  clientId: params.get("client_id") ?? "",
  redirectUri: params.get("redirect_uri") ?? "",
  state: params.get("state") ?? "",
  challenge: params.get("code_challenge") ?? undefined,
  scope: params.get("scope") ?? "openid",
  nonce: params.get("nonce") || undefined,
});

const callback = (redirectUri: string, values: Record<string, string>): Response => {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(values)) if (value) url.searchParams.set(key, value);
  return redirect(url.toString());
};

const approve = (state: MockState, input: AuthorizeParams): Response => {
  const code = nextId(state, "code");
  state.oidc.codes.set(code, { clientId: input.clientId, redirectUri: input.redirectUri, challenge: input.challenge, scope: input.scope, nonce: input.nonce });
  return callback(input.redirectUri, { code, state: input.state });
};

const hidden = (name: string, value: string): string => `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`;

const decide = (state: MockState, input: AuthorizeParams, decision: "approve" | "deny" | undefined): Response => {
  if (input.clientId !== state.options.oidcClientId || !input.redirectUri) return html("Mock e-INFRA sign-in", "<p>Unknown client.</p>", 400);
  if (decision === "deny" || (decision === undefined && state.oidc.denyNext)) {
    state.oidc.denyNext = false;
    return callback(input.redirectUri, { error: "access_denied", state: input.state });
  }
  if (decision === "approve" || state.oidc.autoApprove) return approve(state, input);
  const fields = [
    hidden("client_id", input.clientId),
    hidden("redirect_uri", input.redirectUri),
    hidden("state", input.state),
    hidden("code_challenge", input.challenge ?? ""),
    hidden("scope", input.scope),
    hidden("nonce", input.nonce ?? ""),
  ].join("");
  return html(
    "Mock e-INFRA sign-in",
    `<form method="post" action="">${fields}<p>Signing in as ${escapeHtml(TEST_USER.displayName)}.</p><button type="submit" name="decision" value="approve">Continue</button> <button type="submit" name="decision" value="deny">Deny</button></form>`,
  );
};

const tokenResponse = async (state: MockState, request: Request, tokens: { access: string; refresh: string }, scope: string, withIdToken: boolean, nonce?: string) => {
  const body: Record<string, unknown> = {
    token_type: "Bearer",
    access_token: tokens.access,
    expires_in: state.oidc.accessTtlS,
    refresh_token: tokens.refresh,
    scope,
  };
  if (withIdToken) {
    const idToken = await signIdToken(claims(), { issuer: issuerOf(request), audience: state.options.oidcClientId, ttlS: ID_TOKEN_TTL_S, nonce });
    body["id_token"] = idToken;
    state.oidc.issued.push(idToken);
  }
  return HttpResponse.json(body, { headers: { "Cache-Control": "no-store" } });
};

const oidcHandlers = (state: MockState): HttpHandler[] => [
  http.get("*/oidc/.well-known/openid-configuration", ({ request }) => {
    const issuer = issuerOf(request);
    return HttpResponse.json({
      issuer,
      authorization_endpoint: `${issuer}authorize`,
      token_endpoint: `${issuer}token`,
      userinfo_endpoint: `${issuer}userinfo`,
      jwks_uri: `${issuer}jwks`,
      end_session_endpoint: `${issuer}end_session`,
      revocation_endpoint: `${issuer}revoke`,
      response_types_supported: ["code"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"],
      token_endpoint_auth_methods_supported: ["client_secret_basic"],
      code_challenge_methods_supported: ["S256"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      scopes_supported: ["openid", "profile", "email", "offline_access"],
    });
  }),
  http.get("*/oidc/jwks", async () => HttpResponse.json({ keys: [(await getKeys()).jwk] })),

  http.get("*/oidc/authorize", ({ request }) => decide(state, readAuthorize(new URL(request.url).searchParams), undefined)),
  http.post("*/oidc/authorize", async ({ request }) => {
    const form = new URLSearchParams(await request.text());
    return decide(state, readAuthorize(form), form.get("decision") === "deny" ? "deny" : "approve");
  }),

  http.post("*/oidc/token", async ({ request }) => {
    if (!clientAuthorised(state, request)) return oauthError(401, "invalid_client");
    const form = new URLSearchParams(await request.text());
    const grant = form.get("grant_type");
    if (grant === "authorization_code") {
      const code = form.get("code") ?? "";
      const entry = state.oidc.codes.get(code);
      state.oidc.codes.delete(code);
      if (!entry || entry.redirectUri !== form.get("redirect_uri")) return oauthError(400, "invalid_grant");
      if (entry.challenge !== undefined && sha256Base64Url(form.get("code_verifier") ?? "") !== entry.challenge) return oauthError(400, "invalid_grant");
      return tokenResponse(state, request, issueTokens(state), entry.scope, true, entry.nonce);
    }
    if (grant === "refresh_token") {
      state.oidc.counters.refreshCalls++;
      if (state.oidc.refreshFault !== undefined) return oauthError(state.oidc.refreshFault, "server_error");
      const refresh = form.get("refresh_token") ?? "";
      const known = state.oidc.refreshTokens.get(refresh);
      if (!known || !known.active || known.expiresAt <= Date.now()) return oauthError(400, "invalid_grant");
      return tokenResponse(state, request, issueTokens(state, refresh), "openid offline_access", false);
    }
    return oauthError(400, "unsupported_grant_type");
  }),

  http.get("*/oidc/userinfo", ({ request }) => {
    const bearer = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
    const token = bearer ? state.oidc.accessTokens.get(bearer) : undefined;
    if (!token || token.revoked || token.expiresAt <= Date.now()) return oauthError(401, "invalid_token");
    return HttpResponse.json(claims());
  }),

  http.get("*/oidc/end_session", ({ request }) => {
    const params = new URL(request.url).searchParams;
    state.oidc.counters.endSessionCalls++;
    if (params.get("id_token_hint")) state.oidc.counters.endSessionWithHint++;
    const target = params.get("post_logout_redirect_uri");
    return target ? redirect(target) : html("Mock e-INFRA sign-out", "<p>You are signed out.</p>");
  }),

  http.post("*/oidc/revoke", async ({ request }) => {
    state.oidc.counters.revokeCalls++;
    if (!clientAuthorised(state, request)) return oauthError(401, "invalid_client");
    const refresh = new URLSearchParams(await request.text()).get("token") ?? "";
    const known = state.oidc.refreshTokens.get(refresh);
    if (known) known.active = false;
    for (const token of state.oidc.accessTokens.values()) if (token.refresh === refresh) token.revoked = true;
    return new HttpResponse(null, { status: 200 });
  }),

  // Test control (mock only): never exists on the real IdP.
  http.get("*/oidc/__control/state", () =>
    HttpResponse.json({ counters: state.oidc.counters, issued: state.oidc.issued, accessTtlS: state.oidc.accessTtlS, rotate: state.oidc.rotate }),
  ),
  http.post("*/oidc/__control/config", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (typeof body["accessTtlS"] === "number") state.oidc.accessTtlS = body["accessTtlS"];
    if (typeof body["rotate"] === "boolean") state.oidc.rotate = body["rotate"];
    if (typeof body["autoApprove"] === "boolean") state.oidc.autoApprove = body["autoApprove"];
    if (typeof body["denyNext"] === "boolean") state.oidc.denyNext = body["denyNext"];
    if ("refreshFault" in body) state.oidc.refreshFault = typeof body["refreshFault"] === "number" ? body["refreshFault"] : undefined;
    return HttpResponse.json({ ok: true });
  }),
  http.post("*/oidc/__control/revoke-all", () => {
    for (const token of state.oidc.refreshTokens.values()) token.active = false;
    for (const token of state.oidc.accessTokens.values()) token.revoked = true;
    return HttpResponse.json({ ok: true });
  }),
  http.post("*/oidc/__control/reset", () => {
    state.oidc.counters = { refreshCalls: 0, endSessionCalls: 0, revokeCalls: 0, endSessionWithHint: 0 };
    state.oidc.issued.length = 0;
    state.oidc.accessTtlS = state.options.oidcAccessTtlS;
    state.oidc.rotate = true;
    state.oidc.autoApprove = false;
    state.oidc.denyNext = false;
    state.oidc.refreshFault = undefined;
    return HttpResponse.json({ ok: true });
  }),
];

// For tests that need a session without driving the browser flow: issues tokens directly.
const mintMockTokens = (state: MockState): { access: string; refresh: string } => issueTokens(state);

export { mintMockTokens, oidcHandlers };
