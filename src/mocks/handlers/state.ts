import { communities, figmaDraftMetadata } from "../fixtures";
import type { MockPublished } from "../fixtures/myDepositions";

type MockOptions = {
  // Ignored: the auth strategies are gone. Kept only so callers written before OIDC still compile; remove at the call sites.
  strategy?: string;
  // Short access lifetimes make refresh testable.
  oidcAccessTtlS?: number;
  oidcRefreshTtlS?: number;
  // Credentials of the mock OIDC client (a confidential client, client_secret_basic).
  oidcClientId?: string;
  oidcClientSecret?: string;
};

type DraftFile = { key: string; size: number; status: "pending" | "completed"; mimetype?: string };

// Simulated upload failure for retry tests: the next `remaining` requests to `stage` answer `status`.
type UploadFault = { stage: "init" | "content" | "commit"; status: number; remaining: number };

type Draft = {
  id: string;
  status: "draft" | "published";
  revision: number;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
  files: DraftFile[];
  doi?: string;
};

// Mock e-INFRA IdP state (src/mocks/handlers/oidc.ts). Token strings are opaque; the IdP invalidates earlier access tokens on refresh.
type OidcAccessToken = { refresh: string; expiresAt: number; revoked: boolean };
type OidcRefreshToken = { active: boolean; expiresAt: number };
type OidcCode = { clientId: string; redirectUri: string; challenge: string | undefined; scope: string; nonce: string | undefined };

type OidcState = {
  codes: Map<string, OidcCode>;
  accessTokens: Map<string, OidcAccessToken>;
  refreshTokens: Map<string, OidcRefreshToken>;
  // Every token string handed out, so tests can prove none leaks to the browser.
  issued: string[];
  accessTtlS: number;
  refreshTtlS: number;
  rotate: boolean;
  autoApprove: boolean;
  denyNext: boolean;
  // When set, refresh_token grants answer this status (simulates an IdP outage).
  refreshFault: number | undefined;
  counters: { refreshCalls: number; endSessionCalls: number; revokeCalls: number; endSessionWithHint: number };
};

type MockState = {
  options: Required<MockOptions>;
  oidc: OidcState;
  drafts: Map<string, Draft>;
  // E-L1 published rows. Empty in tests; seedMyDepositionsDemo fills it for the standalone mock server.
  published: MockPublished[];
  // Keyed by file key. Tests set them directly; file names containing ".fail-once." / ".fail-always." set a content fault at init.
  uploadFaults: Map<string, UploadFault>;
  communities: typeof communities;
  seq: number;
};

const createMockState = (input: MockOptions = {}): MockState => {
  const options: Required<MockOptions> = {
    oidcAccessTtlS: 900,
    oidcRefreshTtlS: 1_209_600,
    oidcClientId: "mock-client",
    oidcClientSecret: "mock-client-secret",
    strategy: "",
    ...input,
  };
  const now = new Date().toISOString();
  const drafts = new Map<string, Draft>([
    [
      "draft-figma",
      {
        id: "draft-figma",
        status: "draft",
        revision: 1,
        created_at: now,
        updated_at: now,
        metadata: structuredClone(figmaDraftMetadata),
        files: [],
      },
    ],
    ["draft-empty", { id: "draft-empty", status: "draft", revision: 1, created_at: now, updated_at: now, metadata: {}, files: [] }],
  ]);
  return {
    options,
    oidc: {
      codes: new Map(),
      accessTokens: new Map(),
      refreshTokens: new Map(),
      issued: [],
      accessTtlS: options.oidcAccessTtlS,
      refreshTtlS: options.oidcRefreshTtlS,
      rotate: true,
      autoApprove: false,
      denyNext: false,
      refreshFault: undefined,
      counters: { refreshCalls: 0, endSessionCalls: 0, revokeCalls: 0, endSessionWithHint: 0 },
    },
    drafts,
    published: [],
    uploadFaults: new Map(),
    communities: structuredClone(communities),
    seq: 1,
  };
};

const nextId = (state: MockState, prefix: string): string => `${prefix}-${++state.seq}-${Math.random().toString(36).slice(2, 8)}`;

export { createMockState, nextId };
export type { Draft, DraftFile, MockOptions, MockState, OidcCode, OidcState, UploadFault };
