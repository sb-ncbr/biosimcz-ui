import "server-only";
import { z } from "zod";

const DEFAULT_SCOPE = "openid profile email organization perun_api offline_access";

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  APP_ORIGIN: z.url(),
  MDPOSIT_BASE_URL: z.url(),
  MDREPO_BASE_URL: z.url(),
  RECORDS_SOURCE: z.enum(["mdposit", "mdrepo"]).default("mdposit"),
  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.url(),
  AUTH_OIDC_ISSUER: z.url(),
  AUTH_OIDC_CLIENT_ID: z.string().min(1),
  AUTH_OIDC_CLIENT_SECRET: z.string().min(1),
  AUTH_OIDC_SCOPE: z.string().min(1).default(DEFAULT_SCOPE),
  AUTH_OIDC_TOKEN_ENDPOINT: z.url().optional(),
  SESSION_TTL_S: z.coerce.number().int().positive().default(28_800),
  SESSION_IDLE_TTL_S: z.coerce.number().int().positive().default(7_200),
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(52_428_800),
  BACKEND_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

type Env = {
  appOrigin: string;
  mdpositBaseUrl: string;
  mdrepoBaseUrl: string;
  // Which backend serves the public records search and detail.
  recordsSource: "mdposit" | "mdrepo";
  auth: {
    secret: string;
    url: string;
    // Always with a trailing slash: the IdP's "iss" claim carries it and must match exactly.
    issuer: string;
    clientId: string;
    clientSecret: string;
    scope: string;
    tokenEndpoint?: string;
  };
  sessionTtlS: number;
  sessionIdleTtlS: number;
  sessionCookie: { name: string; secure: boolean };
  uploadMaxBytes: number;
  backendTimeoutMs: number;
  logLevel: "debug" | "info" | "warn" | "error";
};

const SESSION_COOKIE_BASE = "mdr.session-token";

const loadEnv = (source: Record<string, string | undefined>): Env => {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    // Names only: values may be secrets.
    const keys = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(`Invalid environment configuration: ${keys.join(", ")}`);
  }
  const env = parsed.data;
  const issuer = `${env.AUTH_OIDC_ISSUER.replace(/\/+$/, "")}/`;
  if (env.NODE_ENV === "production") {
    const problems: string[] = [];
    if (new URL(env.AUTH_URL).origin !== new URL(env.APP_ORIGIN).origin) problems.push("AUTH_URL (must match APP_ORIGIN)");
    if (!issuer.startsWith("https:")) problems.push("AUTH_OIDC_ISSUER (must be https in production)");
    if (problems.length > 0) throw new Error(`Invalid environment configuration: ${problems.join(", ")}`);
  }
  const secure = env.AUTH_URL.startsWith("https:");
  return {
    appOrigin: new URL(env.APP_ORIGIN).origin,
    mdpositBaseUrl: env.MDPOSIT_BASE_URL.replace(/\/+$/, ""),
    mdrepoBaseUrl: env.MDREPO_BASE_URL.replace(/\/+$/, ""),
    recordsSource: env.RECORDS_SOURCE,
    auth: {
      secret: env.AUTH_SECRET,
      url: new URL(env.AUTH_URL).origin,
      issuer,
      clientId: env.AUTH_OIDC_CLIENT_ID,
      clientSecret: env.AUTH_OIDC_CLIENT_SECRET,
      scope: env.AUTH_OIDC_SCOPE,
      ...(env.AUTH_OIDC_TOKEN_ENDPOINT !== undefined && { tokenEndpoint: env.AUTH_OIDC_TOKEN_ENDPOINT }),
    },
    sessionTtlS: env.SESSION_TTL_S,
    sessionIdleTtlS: env.SESSION_IDLE_TTL_S,
    // Browsers reject the __Host- prefix without Secure, so plain-http dev falls back to an unprefixed name.
    sessionCookie: { name: secure ? `__Host-${SESSION_COOKIE_BASE}` : SESSION_COOKIE_BASE, secure },
    uploadMaxBytes: env.UPLOAD_MAX_BYTES,
    backendTimeoutMs: env.BACKEND_TIMEOUT_MS,
    logLevel: env.LOG_LEVEL,
  };
};

let cached: Env | undefined;

// Lazy so `next build` can import route modules without runtime configuration.
const getEnv = (): Env => (cached ??= loadEnv(process.env));

const resetEnvCache = (): void => {
  cached = undefined;
};

export { getEnv, loadEnv, resetEnvCache };
export type { Env };
