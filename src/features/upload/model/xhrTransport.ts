import { bffFetch, type BffError } from "@/shared/lib";
import type { ParseStatus } from "./uploadMachine";

class TransportFailure extends Error {
  readonly kind: "network" | "http" | "aborted";
  readonly status?: number;

  constructor(kind: "network" | "http" | "aborted", status?: number) {
    super(`upload ${kind}${status ? ` ${status}` : ""}`);
    this.name = "TransportFailure";
    this.kind = kind;
    this.status = status;
  }
}

type ParseResponse = {
  status: ParseStatus;
  detectedRole?: string;
  fields: { path: string; value: unknown }[];
};

type ContentOptions = { onProgress: (loaded: number) => void; signal: AbortSignal };

interface UploadTransport {
  init(draftId: string, key: string, signal: AbortSignal): Promise<void>;
  putContent(draftId: string, key: string, file: Blob, options: ContentOptions): Promise<void>;
  commit(draftId: string, key: string, signal: AbortSignal): Promise<void>;
  parse(draftId: string, key: string, signal: AbortSignal): Promise<ParseResponse>;
  remove(draftId: string, key: string): Promise<void>;
}

type XhrOptions = {
  // Automatic retries of the content PUT for network errors and 502/503/504. Manual retry lives in the UI.
  retries?: number;
  baseDelayMs?: number;
  createXhr?: () => XMLHttpRequest;
  sleep?: (ms: number) => Promise<void>;
};

const RETRYABLE = new Set([502, 503, 504]);

// Keys are encoded once here; the BFF validates them again.
const filesPath = (draftId: string, key?: string, tail?: string): string =>
  [
    "/bff/depositions",
    encodeURIComponent(draftId),
    "files",
    ...(key === undefined ? [] : [encodeURIComponent(key)]),
    ...(tail ? [tail] : []),
  ].join("/");

const toFailure = (error: BffError): TransportFailure =>
  new TransportFailure(error.kind === "network" ? "network" : "http", error.status);

const unwrap = async <T>(
  promise: Promise<{ ok: true; value: T } | { ok: false; error: BffError }>,
  signal?: AbortSignal,
): Promise<T> => {
  const result = await promise;
  if (result.ok) return result.value;
  throw signal?.aborted ? new TransportFailure("aborted") : toFailure(result.error);
};

const xhrPut = (url: string, file: Blob, options: ContentOptions, createXhr: () => XMLHttpRequest): Promise<void> =>
  new Promise((resolve, reject) => {
    if (options.signal.aborted) {
      reject(new TransportFailure("aborted"));
      return;
    }
    const xhr = createXhr();
    const onAbort = () => xhr.abort();
    const settle = (finish: () => void) => {
      options.signal.removeEventListener("abort", onAbort);
      finish();
    };
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress(event.loaded);
    };
    xhr.onload = () =>
      settle(() => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new TransportFailure("http", xhr.status))));
    xhr.onerror = () => settle(() => reject(new TransportFailure("network")));
    xhr.onabort = () => settle(() => reject(new TransportFailure("aborted")));
    options.signal.addEventListener("abort", onAbort, { once: true });
    xhr.send(file);
  });

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const isRetryable = (error: unknown): boolean =>
  error instanceof TransportFailure && (error.kind === "network" || (error.status !== undefined && RETRYABLE.has(error.status)));

const createXhrTransport = (options: XhrOptions = {}): UploadTransport => {
  const { retries = 2, baseDelayMs = 500, createXhr = () => new XMLHttpRequest(), sleep = defaultSleep } = options;

  return {
    async init(draftId, key, signal) {
      await unwrap(bffFetch<unknown>(filesPath(draftId), { method: "POST", body: JSON.stringify({ key }), signal }), signal);
    },

    async putContent(draftId, key, file, contentOptions) {
      const url = filesPath(draftId, key, "content");
      for (let attempt = 0; ; attempt++) {
        try {
          await xhrPut(url, file, contentOptions, createXhr);
          return;
        } catch (error) {
          if (attempt >= retries || !isRetryable(error) || contentOptions.signal.aborted) throw error;
          // Progress restarts from zero: a partial PUT is discarded by the server.
          contentOptions.onProgress(0);
          await sleep(baseDelayMs * 2 ** attempt * (0.5 + Math.random()));
        }
      }
    },

    async commit(draftId, key, signal) {
      await unwrap(bffFetch<unknown>(filesPath(draftId, key, "commit"), { method: "POST", signal }), signal);
    },

    parse: (draftId, key, signal) =>
      unwrap(bffFetch<ParseResponse>(filesPath(draftId, key, "parse"), { method: "POST", signal }), signal),

    async remove(draftId, key) {
      await unwrap(bffFetch<unknown>(filesPath(draftId, key), { method: "DELETE" }));
    },
  };
};

export { createXhrTransport, TransportFailure };
export type { ContentOptions, ParseResponse, UploadTransport, XhrOptions };
