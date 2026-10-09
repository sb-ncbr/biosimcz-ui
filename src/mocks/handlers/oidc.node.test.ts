import { createHash } from "node:crypto";
import { createLocalJWKSet, jwtVerify } from "jose";
import { beforeEach, describe, expect, it } from "vitest";
import { server } from "@/test/msw";
import { createMockBackend, type MockBackend } from "./index";

const ISSUER = "http://localhost:9090/oidc/";
const CLIENT = { id: "mock-client", secret: "mock-client-secret" };
const REDIRECT = "http://localhost:3000/api/auth/callback/einfracz";
const basic = `Basic ${Buffer.from(`${CLIENT.id}:${CLIENT.secret}`).toString("base64")}`;
const VERIFIER = "v".repeat(64);
const CHALLENGE = createHash("sha256").update(VERIFIER).digest("base64url");

let backend: MockBackend;

beforeEach(() => {
  backend = createMockBackend();
  server.use(...backend.handlers);
});

const authorizeUrl = (extra: Record<string, string> = {}) => {
  const url = new URL(`${ISSUER}authorize`);
  const params = { response_type: "code", client_id: CLIENT.id, redirect_uri: REDIRECT, state: "st", code_challenge: CHALLENGE, code_challenge_method: "S256", scope: "openid", ...extra };
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
};

const token = (form: Record<string, string>, authorization = basic) =>
  fetch(`${ISSUER}token`, { method: "POST", headers: { Authorization: authorization, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(form) });

// Walks authorize (Continue) to the code, as the browser would.
const signIn = async () => {
  const page = await fetch(authorizeUrl(), { redirect: "manual" });
  expect(await page.text()).toContain("Continue");
  const form = new URLSearchParams({ client_id: CLIENT.id, redirect_uri: REDIRECT, state: "st", code_challenge: CHALLENGE, scope: "openid", decision: "approve" });
  const approved = await fetch(`${ISSUER}authorize`, { method: "POST", body: form, redirect: "manual" });
  const target = new URL(approved.headers.get("location")!);
  expect(target.searchParams.get("state")).toBe("st");
  return target.searchParams.get("code")!;
};

describe("mock IdP", () => {
  it("publishes discovery for the request origin with a trailing-slash issuer", async () => {
    const doc = (await (await fetch(`${ISSUER}.well-known/openid-configuration`)).json()) as Record<string, unknown>;
    expect(doc["issuer"]).toBe(ISSUER);
    expect(doc["code_challenge_methods_supported"]).toEqual(["S256"]);
    expect(doc["end_session_endpoint"]).toBe(`${ISSUER}end_session`);
  });

  it("exchanges a code with PKCE and client_secret_basic, and signs a verifiable id_token", async () => {
    const code = await signIn();
    const response = await token({ grant_type: "authorization_code", code, redirect_uri: REDIRECT, code_verifier: VERIFIER });
    const body = (await response.json()) as Record<string, string>;
    expect(body["access_token"]).toBeTruthy();
    expect(body["refresh_token"]).toBeTruthy();
    const jwks = createLocalJWKSet((await (await fetch(`${ISSUER}jwks`)).json()) as never);
    const { payload } = await jwtVerify(body["id_token"]!, jwks, { issuer: ISSUER, audience: CLIENT.id });
    expect(payload["email"]).toBe("depositor@example.org");
    expect(backend.state.oidc.issued).toEqual(expect.arrayContaining([body["access_token"], body["refresh_token"], body["id_token"]]));
  });

  it("echoes the authorize nonce into the id_token, via both the auto-approve and the form path", async () => {
    const jwks = createLocalJWKSet((await (await fetch(`${ISSUER}jwks`)).json()) as never);
    const exchange = async (code: string) => {
      const body = (await (await token({ grant_type: "authorization_code", code, redirect_uri: REDIRECT, code_verifier: VERIFIER })).json()) as Record<string, string>;
      return (await jwtVerify(body["id_token"]!, jwks, { issuer: ISSUER, audience: CLIENT.id })).payload;
    };
    backend.state.oidc.autoApprove = true;
    const auto = await fetch(authorizeUrl({ nonce: "n-auto" }), { redirect: "manual" });
    expect((await exchange(new URL(auto.headers.get("location")!).searchParams.get("code")!))["nonce"]).toBe("n-auto");

    backend.state.oidc.autoApprove = false;
    const page = await (await fetch(authorizeUrl({ nonce: "n-form" }), { redirect: "manual" })).text();
    expect(page).toContain('name="nonce" value="n-form"');
    const form = new URLSearchParams({ client_id: CLIENT.id, redirect_uri: REDIRECT, state: "st", code_challenge: CHALLENGE, scope: "openid", nonce: "n-form", decision: "approve" });
    const approved = await fetch(`${ISSUER}authorize`, { method: "POST", body: form, redirect: "manual" });
    expect((await exchange(new URL(approved.headers.get("location")!).searchParams.get("code")!))["nonce"]).toBe("n-form");
  });

  it("rejects a wrong verifier, a reused code and bad client credentials", async () => {
    expect((await token({ grant_type: "authorization_code", code: await signIn(), redirect_uri: REDIRECT, code_verifier: "wrong" })).status).toBe(400);
    const code = await signIn();
    const form = { grant_type: "authorization_code", code, redirect_uri: REDIRECT, code_verifier: VERIFIER };
    expect((await token(form, "Basic bm9wZTpub3Bl")).status).toBe(401);
    expect((await token(form)).status).toBe(200);
    expect((await token(form)).status).toBe(400);
  });

  it("sends access_denied once when told to deny", async () => {
    backend.state.oidc.denyNext = true;
    const denied = await fetch(authorizeUrl(), { redirect: "manual" });
    expect(new URL(denied.headers.get("location")!).searchParams.get("error")).toBe("access_denied");
    expect((await fetch(authorizeUrl(), { redirect: "manual" })).status).toBe(200);
  });

  it("rotates on refresh and invalidates the earlier access token and refresh token", async () => {
    const first = (await (await token({ grant_type: "authorization_code", code: await signIn(), redirect_uri: REDIRECT, code_verifier: VERIFIER })).json()) as Record<string, string>;
    const second = (await (await token({ grant_type: "refresh_token", refresh_token: first["refresh_token"]! })).json()) as Record<string, string>;
    expect(second["access_token"]).not.toBe(first["access_token"]);
    expect(backend.state.oidc.accessTokens.get(first["access_token"]!)?.revoked).toBe(true);
    expect((await token({ grant_type: "refresh_token", refresh_token: first["refresh_token"]! })).status).toBe(400);
    expect(backend.state.oidc.counters.refreshCalls).toBe(2);
  });

  it("answers the configured fault and revokes everything on request", async () => {
    const first = (await (await token({ grant_type: "authorization_code", code: await signIn(), redirect_uri: REDIRECT, code_verifier: VERIFIER })).json()) as Record<string, string>;
    await fetch(`${ISSUER}__control/config`, { method: "POST", body: JSON.stringify({ refreshFault: 503 }) });
    expect((await token({ grant_type: "refresh_token", refresh_token: first["refresh_token"]! })).status).toBe(503);
    await fetch(`${ISSUER}__control/config`, { method: "POST", body: JSON.stringify({ refreshFault: null }) });
    await fetch(`${ISSUER}__control/revoke-all`, { method: "POST" });
    expect((await token({ grant_type: "refresh_token", refresh_token: first["refresh_token"]! })).status).toBe(400);
  });

  it("counts end-session calls, with and without hint, and honours post_logout_redirect_uri", async () => {
    const url = new URL(`${ISSUER}end_session`);
    url.searchParams.set("id_token_hint", "x");
    url.searchParams.set("post_logout_redirect_uri", "http://localhost:3000/login");
    const response = await fetch(url, { redirect: "manual" });
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
    expect(backend.state.oidc.counters).toMatchObject({ endSessionCalls: 1, endSessionWithHint: 1 });
  });

  it("makes the mock MDRepo accept only active, unexpired mock access tokens", async () => {
    const tokens = (await (await token({ grant_type: "authorization_code", code: await signIn(), redirect_uri: REDIRECT, code_verifier: VERIFIER })).json()) as Record<string, string>;
    const me = (accessToken: string) => fetch("http://mdrepo.test/api/me", { headers: { Authorization: `Bearer ${accessToken}` } });
    expect((await me(tokens["access_token"]!)).status).toBe(200);
    expect((await me("nope")).status).toBe(401);
    backend.state.oidc.accessTokens.get(tokens["access_token"]!)!.expiresAt = Date.now() - 1;
    const expired = await me(tokens["access_token"]!);
    expect(expired.status).toBe(401);
    expect(await expired.json()).toMatchObject({ code: "token_expired" });
  });
});
