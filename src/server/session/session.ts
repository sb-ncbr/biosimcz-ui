import "server-only";
import type { SessionUser } from "@/entities/session";

// What the rest of the app sees: identity only, never tokens.
type Session = { user: SessionUser };

type SessionUpdate = {
  // Forces the jwt callback to refresh the access token even when it is not near expiry.
  refresh?: boolean;
};

// Abstraction over next/headers so the session logic runs in tests alike.
type CookieJar = {
  // RSC renders cannot set cookies; refresh and updates are skipped when false.
  readonly writable: boolean;
  get(name: string): string | undefined;
  // Needed to reassemble the chunked Auth.js cookie.
  getAll(): { name: string; value: string }[];
  delete(name: string): void;
  // Persists activity and refreshed tokens into the session cookie (production: Auth.js unstable_update).
  update(data: SessionUpdate): Promise<void>;
};

export type { CookieJar, Session, SessionUpdate };
