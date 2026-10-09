# Runtime contract

What the app needs from its environment. Authentication follows `plans/oidc-auth.md` (Auth.js v5, `next-auth@5.0.0-beta.32`, provider id `einfracz`).

## Environment (see `template.env`, placeholders only)

| Key | Kind | Notes |
|---|---|---|
| `APP_ORIGIN` | config | Public origin; BFF origin check and HSTS. In production it must equal the origin of `AUTH_URL`. |
| `MDPOSIT_BASE_URL`, `MDREPO_BASE_URL` | config | Backends. |
| `AUTH_SECRET` | Secret | At least 32 characters. Identical on all replicas; rotating it signs everyone out. |
| `AUTH_URL` | config | Public base URL (`https://<host>`). |
| `AUTH_OIDC_ISSUER` | config | `https://login.e-infra.cz/oidc/` (trailing slash is added if missing). Must be https in production. |
| `AUTH_OIDC_CLIENT_ID`, `AUTH_OIDC_CLIENT_SECRET` | Secret | Confidential client, `client_secret_basic`. |
| `AUTH_OIDC_SCOPE` | config | Default `openid profile email organization perun_api offline_access`. |
| `AUTH_OIDC_TOKEN_ENDPOINT` | config, optional | Derived from the issuer when absent. |
| `SESSION_TTL_S`, `SESSION_IDLE_TTL_S` | config | Absolute (8 h) and idle (2 h) limits. |
| `MOCK_PORT`, `MOCK_OIDC_CLIENT_ID`, `MOCK_OIDC_CLIENT_SECRET`, `MOCK_OIDC_ACCESS_TTL_S` | dev only | `npm run mock` (MDposit, MDRepo and the OIDC IdP on one port). |

Secret keys (`secretKeyRef`): `AUTH_SECRET`, `AUTH_OIDC_CLIENT_ID`, `AUTH_OIDC_CLIENT_SECRET`.

## e-INFRA client registration (per environment)

- Confidential client, grant types `authorization_code` and `refresh_token`, `client_secret_basic`, PKCE (S256).
- Scopes as `AUTH_OIDC_SCOPE`.
- Redirect URI `https://<host>/api/auth/callback/einfracz` (plus `http://localhost:3000/api/auth/callback/einfracz` for dev).
- Post-logout redirect URI `https://<host>/login`.
- Egress HTTPS to `login.e-infra.cz`.
- Ingress header buffers of at least 16 KB: the session cookie holds three tokens and is chunked by Auth.js (nginx `large-client-header-buffers`, `proxy-buffer-size`).
- Optional cookie affinity to reduce cross-replica refresh races.
- CSP later: `form-action` must allow `https://login.e-infra.cz`.

## Auth notes (A0, verified 2026-10-01)

Public discovery document `https://login.e-infra.cz/oidc/.well-known/openid-configuration`:

- `end_session_endpoint`: `https://login.e-infra.cz/oidc/endsession`.
- `revocation_endpoint`: `https://login.e-infra.cz/oidc/revoke`.
- `token_endpoint_auth_methods_supported`: `client_secret_basic`, `client_secret_post`, `none`.
- `code_challenge_methods_supported`: `plain`, `S256`, `none` (Auth.js uses S256).
- The provider declares `checks: ["pkce", "state", "nonce"]`; Auth.js 0.41.3 binds each check cookie to the provider and validates the id_token `nonce` claim. The mock IdP echoes the authorize `nonce` into the id_token.

Installed `@auth/core` 0.41.3 (next-auth beta.32; fixes GHSA-x445-f3h2-j279; every behaviour below re-verified against it on 2026-10-04):

- A `jwt` callback returning `null` signs the user out: the cookie chunks are cleaned (`lib/actions/session.js`, `lib/actions/callback/index.js`). Used for the 8 h and 2 h limits.
- `session.updateAge` has no effect on JWT sessions: every session read (proxy page navigations, `unstable_update`) re-signs the cookie with a fresh expiry. The 60 s throttle is ours (`lastActiveAt` moves at most once a minute).
- `?error=` codes: types `Configuration`, `AccessDenied`, `Verification` are documented; callback failures arrive as other `AuthError` types (for example `OAuthCallbackError`). The login page gives specific copy to the three documented codes and a generic message to everything else.
- An `http://` issuer works: the discovery, token and userinfo calls set `allowInsecureRequests`, so the mock IdP runs on plain http.
- `getToken` accepts `cookieName` and `salt` (both are the session cookie name); it reassembles chunked cookies and also honours an `Authorization: Bearer` header, so only a cookie header is passed.
- `token.sub` is NOT the IdP subject: Auth.js assigns a random UUID as the user id. The stable e-INFRA id is `account.providerAccountId`, which the `jwt` callback stores as `sub`.
- In the lazy form `NextAuth(() => config)`, `auth(wrapper)` returns a promise of the handler, so `proxy.ts` awaits it.
- Auth.js's `auth(handler)` appends the re-issued session cookie after the handler's own Set-Cookie, so a deletion in the same response loses against an active session. The `?expired` clearing therefore runs before the Auth.js wrapper.
- `unstable_update` writes through `cookies().set`, so it works in route handlers and server actions; it is not callable from RSC renders (read-only cookies).

Session model:

- Cookie `__Host-mdr.session-token` on https, `mdr.session-token` on http, encrypted with `AUTH_SECRET`, chunked by Auth.js.
- Session callback and `/api/auth/session` return `{ user: { id, name, email, username }, expires, error? }` only. Tokens are read server-side by `src/server/session/token.ts` through `getToken`.
- Refresh runs through one shared refresher keyed by the SHA-256 of the refresh token (30 s reuse, `globalThis`). Only `invalid_grant`, 400 and 401 end the session; network errors, timeouts and 5xx keep the old token.
- Logout: best-effort revocation of the refresh token, local sign-out, then the IdP end-session endpoint with `id_token_hint`, `client_id` and `post_logout_redirect_uri` when advertised; the browser first wipes the local draft mirrors.

## Mock IdP (`npm run mock`, port 9090)

Issuer `http://localhost:9090/oidc/`. Test control under `/oidc/__control/{state,config,revoke-all,reset}` (mock only). Playwright passes the mock client and a per-run `AUTH_SECRET` to the Next server through `playwright.config.ts`.
