import { HttpResponse } from "msw";
import type { MockState } from "./state";

const problem = (status: number, code: string, message: string, extra: Record<string, unknown> = {}) =>
  HttpResponse.json({ status, code, message, ...extra }, { status });

// Returns a 401 response when the request does not carry an active access token issued by the mock IdP, else null.
// The IdP invalidates earlier access tokens on refresh, so a stale token is "inactive" like on the real backend.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- write stays in the signature so every mock handler keeps calling it the same way
const authorize = (state: MockState, request: Request, _write = false): Response | null => {
  const bearer = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
  const token = bearer ? state.oidc.accessTokens.get(bearer) : undefined;
  if (!token || token.revoked) return problem(401, "unauthorized", "Login required");
  if (token.expiresAt <= Date.now()) return problem(401, "token_expired", "Access token expired");
  return null;
};

export { authorize, problem };
