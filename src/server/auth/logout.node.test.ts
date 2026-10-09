import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { server } from "@/test/msw";
import { setTestEnv } from "@/test/serverEnv";
import { buildEndSessionUrl, revokeRefreshToken } from "./logout";

beforeEach(() => setTestEnv());

describe("buildEndSessionUrl", () => {
  it("adds id_token_hint, client_id and the post-logout redirect to /login", () => {
    const url = new URL(buildEndSessionUrl({ endSessionEndpoint: "https://idp.test/oidc/endsession", idToken: "id-token-value" })!);
    expect(url.origin + url.pathname).toBe("https://idp.test/oidc/endsession");
    expect(url.searchParams.get("id_token_hint")).toBe("id-token-value");
    expect(url.searchParams.get("client_id")).toBe("mock-client");
    expect(url.searchParams.get("post_logout_redirect_uri")).toBe("http://localhost:3000/login");
  });

  it("omits the hint when the session has no id token", () => {
    const url = new URL(buildEndSessionUrl({ endSessionEndpoint: "https://idp.test/oidc/endsession" })!);
    expect(url.searchParams.has("id_token_hint")).toBe(false);
    expect(url.searchParams.get("client_id")).toBe("mock-client");
  });

  it("returns null when the IdP advertises no end_session_endpoint", () => {
    expect(buildEndSessionUrl({ endSessionEndpoint: undefined, idToken: "x" })).toBeNull();
  });
});

describe("revokeRefreshToken", () => {
  it("posts the token with client credentials and reports success", async () => {
    let seen: { body: string; authorization: string | null } | undefined;
    server.use(
      http.post("http://idp.test/oidc/revoke", async ({ request }) => {
        seen = { body: await request.text(), authorization: request.headers.get("authorization") };
        return new HttpResponse(null, { status: 200 });
      }),
    );
    expect(await revokeRefreshToken("http://idp.test/oidc/revoke", "rt-1")).toBe(true);
    expect(seen?.body).toContain("token=rt-1");
    expect(seen?.authorization).toMatch(/^Basic /);
  });

  it("never throws: an IdP failure just reports false", async () => {
    server.use(http.post("http://idp.test/oidc/revoke", () => HttpResponse.error()));
    expect(await revokeRefreshToken("http://idp.test/oidc/revoke", "rt-1")).toBe(false);
    server.use(http.post("http://idp.test/oidc/revoke", () => new HttpResponse(null, { status: 500 })));
    expect(await revokeRefreshToken("http://idp.test/oidc/revoke", "rt-1")).toBe(false);
  });
});
