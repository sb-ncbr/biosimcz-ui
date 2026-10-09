import "server-only";
import { getEnv } from "../config/env";
import { logger } from "../lib/logger";

const REVOKE_TIMEOUT_MS = 3_000;

type EndSessionInput = { endSessionEndpoint: string | undefined; idToken?: string | undefined };

// RP-initiated logout (OIDC): null when the IdP does not advertise an end_session_endpoint, so the caller stays local.
const buildEndSessionUrl = ({ endSessionEndpoint, idToken }: EndSessionInput): string | null => {
  if (!endSessionEndpoint) return null;
  const { auth } = getEnv();
  const url = new URL(endSessionEndpoint);
  if (idToken) url.searchParams.set("id_token_hint", idToken);
  url.searchParams.set("client_id", auth.clientId);
  url.searchParams.set("post_logout_redirect_uri", `${auth.url}/login`);
  return url.toString();
};

// Best effort (RFC 7009): a failure never keeps the local session alive.
const revokeRefreshToken = async (revocationEndpoint: string, refreshToken: string): Promise<boolean> => {
  const { clientId, clientSecret } = getEnv().auth;
  const basic = Buffer.from(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`).toString("base64");
  try {
    const response = await fetch(revocationEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basic}` },
      body: new URLSearchParams({ token: refreshToken, token_type_hint: "refresh_token" }),
      signal: AbortSignal.timeout(REVOKE_TIMEOUT_MS),
    });
    if (!response.ok) logger.warn("token revocation failed", { code: `http_${response.status}` });
    return response.ok;
  } catch {
    logger.warn("token revocation failed", { code: "network" });
    return false;
  }
};

export { buildEndSessionUrl, revokeRefreshToken };
