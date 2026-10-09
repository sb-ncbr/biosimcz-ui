import { err, ok, type Result } from "./result";

// Mirrors the server DTO (server/http/errors.ts); duplicated because shared/ cannot import server code.
type BffError = {
  kind: string;
  status?: number;
  code?: string;
  messageKey: string;
  fieldErrors?: Record<string, string>;
};

const FALLBACK: BffError = { kind: "network", messageKey: "errors.network" };

const isProblem = (value: unknown): value is BffError =>
  typeof value === "object" && value !== null && typeof (value as { messageKey?: unknown }).messageKey === "string";

// Only same-origin /bff/** URLs: the browser never talks to a backend.
const bffFetch = async <T>(path: string, init: RequestInit = {}): Promise<Result<T, BffError>> => {
  if (!path.startsWith("/bff/")) throw new Error("bffFetch only accepts /bff/ paths");
  const headers = new Headers(init.headers);
  if (typeof init.body === "string" && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(path, { ...init, headers, credentials: "same-origin" });
  } catch {
    return err(FALLBACK);
  }
  if (response.ok) {
    if (response.status === 204) return ok(undefined as T);
    return ok((await response.json()) as T);
  }
  const problem: unknown = await response.json().catch(() => undefined);
  return err(isProblem(problem) ? problem : { kind: "http", status: response.status, messageKey: "errors.http" });
};

export { bffFetch };
export type { BffError };
