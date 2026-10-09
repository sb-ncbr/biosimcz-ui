import "server-only";
import NextAuth, { type NextAuthConfig } from "next-auth";
import { getEnv } from "../config/env";
import { logger } from "../lib/logger";
import { jwtCallback, redirectCallback, sessionCallback } from "./callbacks";
import { sessionCookieName, sessionCookieOptions } from "./cookie";

const PROVIDER_ID = "einfracz";

const errorCode = (error: unknown): string => {
  if (typeof error !== "object" || error === null) return "unknown";
  const type = (error as { type?: unknown }).type;
  return typeof type === "string" ? type : error instanceof Error ? error.name : "unknown";
};

// Values come from getEnv() at call time, so `next build` can import this module without runtime configuration.
const createAuthConfig = (): NextAuthConfig => {
  const env = getEnv();
  const { issuer, clientId, clientSecret, scope } = env.auth;
  return {
    trustHost: true,
    secret: env.auth.secret,
    // Never on: debug output includes token details. Our logger gets error codes only.
    debug: false,
    logger: {
      error: (error) => logger.error("auth error", { code: errorCode(error) }),
      warn: (code) => logger.warn("auth warning", { code }),
      debug: () => undefined,
    },
    // maxAge is the idle limit: every session read re-issues the cookie. The absolute limit lives in the jwt callback.
    session: { strategy: "jwt", maxAge: env.sessionIdleTtlS, updateAge: 60 },
    cookies: { sessionToken: { name: sessionCookieName(), options: sessionCookieOptions() } },
    providers: [
      {
        id: PROVIDER_ID,
        name: "e-INFRA CZ",
        type: "oidc",
        issuer,
        wellKnown: `${issuer}.well-known/openid-configuration`,
        clientId,
        clientSecret,
        client: { token_endpoint_auth_method: "client_secret_basic" },
        authorization: { params: { scope, prompt: "consent" } },
        checks: ["pkce", "state", "nonce"],
        profile(profile) {
          const sub = String(profile.sub);
          return {
            id: sub,
            username: sub.toLowerCase(),
            name: [profile["given_name"], profile["family_name"]].filter((part) => typeof part === "string" && part).join(" ") || undefined,
            email: typeof profile.email === "string" ? profile.email : undefined,
          };
        },
      },
    ],
    pages: { signIn: "/login", error: "/login", signOut: "/login" },
    callbacks: {
      jwt: (params) => jwtCallback(params) as Promise<never>,
      session: (params) => sessionCallback(params as never) as never,
      redirect: redirectCallback,
    },
  };
};

const { handlers, auth, signIn, signOut, unstable_update } = NextAuth(() => createAuthConfig());

export { auth, handlers, PROVIDER_ID, signIn, signOut, unstable_update };
