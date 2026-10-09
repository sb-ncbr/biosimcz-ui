import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockBackend } from "@/mocks/handlers";
import { resetDiscoveryCache } from "@/server/auth/discovery";
import { createMemoryJar, signInJar } from "@/test/memoryJar";
import { server } from "@/test/msw";
import { setTestEnv } from "@/test/serverEnv";

const held = vi.hoisted(() => ({
  jar: undefined as unknown,
  signOut: vi.fn<(options: { redirect: boolean }) => Promise<void>>().mockResolvedValue(undefined),
  signIn: vi.fn<(provider: string, options: { redirectTo: string }) => Promise<void>>().mockResolvedValue(undefined),
}));

vi.mock("@/server/session/nextJar", () => ({ nextCookieJar: async () => held.jar }));
vi.mock("@/server/auth/config", () => ({ signIn: held.signIn, signOut: held.signOut, PROVIDER_ID: "einfracz" }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
  },
}));

const { logout, signInWithEinfra } = await import("./actions");

const discovery = (extra: Record<string, unknown>) =>
  server.use(
    http.get("http://idp.test/oidc/.well-known/openid-configuration", () =>
      HttpResponse.json({ issuer: "http://idp.test/oidc/", token_endpoint: "http://idp.test/oidc/token", ...extra }),
    ),
  );

beforeEach(async () => {
  setTestEnv();
  resetDiscoveryCache();
  held.signOut.mockClear();
  held.signIn.mockClear();
  const backend = createMockBackend();
  server.use(...backend.handlers);
  const jar = createMemoryJar();
  await signInJar(jar, backend.state, { idToken: "the-id-token" });
  held.jar = jar;
});

describe("logout", () => {
  it("revokes the refresh token, signs out locally and returns the end-session URL with id_token_hint", async () => {
    let revoked = 0;
    discovery({ end_session_endpoint: "http://idp.test/oidc/end_session", revocation_endpoint: "http://idp.test/oidc/revoke" });
    server.use(
      http.post("http://idp.test/oidc/revoke", () => {
        revoked++;
        return new HttpResponse(null, { status: 200 });
      }),
    );
    const { redirectTo } = await logout();
    const url = new URL(redirectTo);
    expect(url.pathname).toBe("/oidc/end_session");
    expect(url.searchParams.get("id_token_hint")).toBe("the-id-token");
    expect(url.searchParams.get("client_id")).toBe("mock-client");
    expect(url.searchParams.get("post_logout_redirect_uri")).toBe("http://localhost:3000/login");
    expect(revoked).toBe(1);
    expect(held.signOut).toHaveBeenCalledWith({ redirect: false });
  });

  it("falls back to /login when the IdP advertises no end-session endpoint", async () => {
    discovery({});
    expect((await logout()).redirectTo).toBe("/login");
    expect(held.signOut).toHaveBeenCalledOnce();
  });

  it("still signs out when revocation fails and when discovery is down", async () => {
    discovery({ end_session_endpoint: "http://idp.test/oidc/end_session", revocation_endpoint: "http://idp.test/oidc/revoke" });
    server.use(http.post("http://idp.test/oidc/revoke", () => HttpResponse.error()));
    expect((await logout()).redirectTo).toContain("end_session");
    expect(held.signOut).toHaveBeenCalledTimes(1);
    resetDiscoveryCache();
    server.use(http.get("http://idp.test/oidc/.well-known/openid-configuration", () => HttpResponse.error()));
    expect((await logout()).redirectTo).toBe("/login");
    expect(held.signOut).toHaveBeenCalledTimes(2);
  });

  it("works without a session", async () => {
    held.jar = createMemoryJar();
    discovery({});
    expect((await logout()).redirectTo).toBe("/login");
  });
});

describe("signInWithEinfra", () => {
  it("passes only a safe next to Auth.js", async () => {
    const form = (next: string) => {
      const data = new FormData();
      data.set("next", next);
      return data;
    };
    await signInWithEinfra(form("/depositions/abc/system"));
    await signInWithEinfra(form("https://evil.example"));
    await signInWithEinfra(form("//evil.example"));
    expect(held.signIn.mock.calls.map((call) => call[1].redirectTo)).toEqual(["/depositions/abc/system", "/", "/"]);
  });

  it("lands on a readable error when sign-in cannot start", async () => {
    held.signIn.mockRejectedValueOnce(new Error("discovery failed"));
    await expect(signInWithEinfra(new FormData())).rejects.toThrow("redirect:/login?error=Configuration");
  });
});
