import "server-only";
import { getEnv } from "../config/env";
import { ApiError } from "../http/errors";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

type HeaderReader = { get: (name: string) => string | null };

// CSRF guard for non-GET handlers: the Origin header must match APP_ORIGIN. Without Origin (some same-origin requests)
// Sec-Fetch-Site must say same-origin; a request with neither header is rejected.
const assertSameOriginHeaders = (method: string, headers: HeaderReader): void => {
  if (SAFE_METHODS.has(method.toUpperCase())) return;
  const origin = headers.get("origin");
  const allowed = getEnv().appOrigin;
  const ok = origin !== null ? origin === allowed : headers.get("sec-fetch-site") === "same-origin";
  if (!ok) throw new ApiError({ kind: "forbidden", backend: "mdrepo", code: "csrf" });
};

// Route handlers.
const assertSameOrigin = (req: Request): void => assertSameOriginHeaders(req.method, req.headers);

export { assertSameOrigin, assertSameOriginHeaders };
