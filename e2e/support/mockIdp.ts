// Control surface of the mock e-INFRA IdP (src/mocks/handlers/oidc.ts, "/oidc/__control"). Mock only.
const IDP = process.env["MOCK_IDP_URL"] ?? "http://localhost:9090/oidc";

type IdpState = {
  counters: { refreshCalls: number; endSessionCalls: number; revokeCalls: number; endSessionWithHint: number };
  // Every token string the IdP has handed out (access, refresh, id): none may ever reach the browser.
  issued: string[];
  accessTtlS: number;
  rotate: boolean;
};

type IdpConfig = { accessTtlS?: number; rotate?: boolean; autoApprove?: boolean; denyNext?: boolean; refreshFault?: number | null };

const post = async (path: string, body?: unknown): Promise<void> => {
  const response = await fetch(`${IDP}/__control/${path}`, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
  if (!response.ok) throw new Error(`mock IdP control ${path} answered ${response.status}`);
};

const idp = {
  state: async (): Promise<IdpState> => (await fetch(`${IDP}/__control/state`)).json() as Promise<IdpState>,
  configure: (config: IdpConfig): Promise<void> => post("config", config),
  revokeAll: (): Promise<void> => post("revoke-all"),
  reset: (): Promise<void> => post("reset"),
};

export { idp };
export type { IdpState };
