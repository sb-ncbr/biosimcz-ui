import "server-only";
import type { DefaultSession } from "next-auth";

// Tokens never appear here: the session callback returns identity claims only (plan rule R1).
declare module "next-auth" {
  interface Session {
    user: { id: string; username?: string } & DefaultSession["user"];
    error?: SessionError;
  }
  interface User {
    username?: string;
  }
}

type SessionError = "RefreshAccessTokenError" | "SessionExpired";

// Content of the encrypted Auth.js cookie. Server-only: read through server/session/token.ts.
type MdrJwt = {
  sub: string;
  name?: string;
  email?: string;
  username?: string;
  accessToken: string;
  accessTokenExpires: number;
  refreshToken?: string;
  idToken?: string;
  authTime: number;
  lastActiveAt: number;
  error?: "RefreshAccessTokenError";
};

export type { MdrJwt, SessionError };
