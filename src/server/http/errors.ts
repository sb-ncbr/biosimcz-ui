import "server-only";

type Backend = "mdposit" | "mdrepo";

type ApiErrorKind =
  | "network"
  | "timeout"
  | "http"
  | "schema"
  | "auth"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation";

// Safe to send to the browser: message keys only, never upstream text or Zod issues.
type ApiErrorDTO = {
  kind: ApiErrorKind;
  status?: number;
  code?: string;
  messageKey: string;
  fieldErrors?: Record<string, string>;
};

type ApiErrorInit = {
  kind: ApiErrorKind;
  backend: Backend;
  status?: number;
  code?: string;
  messageKey?: string;
  fieldErrors?: Record<string, string>;
  cause?: unknown;
};

class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly backend: Backend;
  readonly status?: number;
  readonly code?: string;
  readonly messageKey: string;
  readonly fieldErrors?: Record<string, string>;

  constructor(init: ApiErrorInit) {
    super(`${init.backend} ${init.kind}${init.status ? ` ${init.status}` : ""}${init.code ? ` ${init.code}` : ""}`, {
      cause: init.cause,
    });
    this.name = "ApiError";
    this.kind = init.kind;
    this.backend = init.backend;
    this.status = init.status;
    this.code = init.code;
    this.messageKey = init.messageKey ?? `errors.${init.kind}`;
    this.fieldErrors = init.fieldErrors;
  }
}

const kindForStatus = (status: number): ApiErrorKind => {
  if (status === 401) return "auth";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409 || status === 412) return "conflict";
  if (status === 400 || status === 422) return "validation";
  return "http";
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

const slug = (value: unknown): string | undefined =>
  typeof value === "string" && /^[a-z0-9_.-]{1,64}$/i.test(value) ? value.toLowerCase() : undefined;

// Accepts the proposed shape ({ field, code }) and InvenioRDM's ({ field, messages[] }).
const extractFieldErrors = (errors: unknown): Record<string, string> | undefined => {
  if (!Array.isArray(errors)) return undefined;
  const entries = errors.flatMap((item): [string, string][] => {
    const record = asRecord(item);
    const field = record && typeof record["field"] === "string" ? record["field"] : undefined;
    if (!field) return [];
    return [[field, `errors.field.${slug(record?.["code"]) ?? "invalid"}`]];
  });
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const fromResponseBody = (backend: Backend, status: number, body: unknown): ApiError => {
  const record = asRecord(body);
  const code = slug(record?.["code"]);
  const kind = kindForStatus(status);
  return new ApiError({
    kind,
    backend,
    status,
    code,
    messageKey: code ? `errors.${kind}.${code}` : undefined,
    fieldErrors: extractFieldErrors(record?.["errors"]),
  });
};

const isApiError = (value: unknown): value is ApiError => value instanceof ApiError;

const toDTO = (error: unknown): ApiErrorDTO => {
  if (!isApiError(error)) return { kind: "http", code: "unexpected", messageKey: "errors.unexpected" };
  return {
    kind: error.kind,
    ...(error.status !== undefined && { status: error.status }),
    ...(error.code !== undefined && { code: error.code }),
    messageKey: error.messageKey,
    ...(error.fieldErrors && { fieldErrors: error.fieldErrors }),
  };
};

const HTTP_STATUS_FOR_KIND: Record<ApiErrorKind, number> = {
  network: 502,
  timeout: 504,
  http: 502,
  schema: 502,
  auth: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  validation: 422,
};

// Status we send to the browser: our own view of the failure, not a copy of the upstream status.
const statusForKind = (error: ApiError): number =>
  error.kind === "http" && error.status !== undefined && error.status >= 400 && error.status < 500
    ? error.status
    : HTTP_STATUS_FOR_KIND[error.kind];

const problemResponse = (error: unknown): Response => {
  const dto = toDTO(error);
  const status = isApiError(error) ? statusForKind(error) : 500;
  return new Response(JSON.stringify(dto), {
    status,
    headers: { "Content-Type": "application/problem+json", "Cache-Control": "no-store" },
  });
};

export { ApiError, fromResponseBody, isApiError, problemResponse, toDTO };
export type { ApiErrorDTO, Backend };
