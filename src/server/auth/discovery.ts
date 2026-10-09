import "server-only";
import { getEnv } from "../config/env";
import { logger } from "../lib/logger";

type Discovery = { endSessionEndpoint?: string; revocationEndpoint?: string; tokenEndpoint?: string };

const TTL_MS = 3_600_000;
const TIMEOUT_MS = 5_000;

const g = globalThis as typeof globalThis & { __mdrDiscovery?: { at: number; value: Discovery } };

const text = (value: unknown): string | undefined => (typeof value === "string" && value.length > 0 ? value : undefined);

// Cached for an hour per process; failures are not cached so the next call retries.
const getDiscovery = async (): Promise<Discovery> => {
  const cached = g.__mdrDiscovery;
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  try {
    const response = await fetch(`${getEnv().auth.issuer}.well-known/openid-configuration`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) throw new Error(`status ${response.status}`);
    const body = (await response.json()) as Record<string, unknown>;
    const endSessionEndpoint = text(body["end_session_endpoint"]);
    const revocationEndpoint = text(body["revocation_endpoint"]);
    const tokenEndpoint = text(body["token_endpoint"]);
    const value: Discovery = {
      ...(endSessionEndpoint && { endSessionEndpoint }),
      ...(revocationEndpoint && { revocationEndpoint }),
      ...(tokenEndpoint && { tokenEndpoint }),
    };
    g.__mdrDiscovery = { at: Date.now(), value };
    return value;
  } catch (error) {
    logger.warn("oidc discovery failed", { name: error instanceof Error ? error.name : "unknown" });
    return {};
  }
};

const resetDiscoveryCache = (): void => {
  delete g.__mdrDiscovery;
};

export { getDiscovery, resetDiscoveryCache };
