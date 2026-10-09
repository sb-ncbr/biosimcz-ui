import type { BffError } from "@/shared/lib";

type DownloadProgress = { receivedBytes: number; totalBytes: number | null };

type DownloadOptions = { signal?: AbortSignal; onProgress?: (progress: DownloadProgress) => void };

// Carries the BFF problem (message key, field errors) so the form can show the right text without parsing prose.
class TrajectoryDownloadError extends Error {
  readonly problem: BffError;
  // Seconds from Retry-After on a 429; null when the header is absent.
  readonly retryAfterSeconds: number | null;

  constructor(problem: BffError, retryAfterSeconds: number | null = null) {
    super(problem.messageKey);
    this.name = "TrajectoryDownloadError";
    this.problem = problem;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const isProblem = (value: unknown): value is BffError =>
  typeof value === "object" && value !== null && typeof (value as { messageKey?: unknown }).messageKey === "string";

const parseRetryAfter = (value: string | null): number | null => {
  if (value === null) return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
};

// Only a plain integer length is trusted for the percentage: an encoded body has a different size than the header says.
const parseContentLength = (response: Response): number | null => {
  if (response.headers.has("Content-Encoding")) return null;
  const value = response.headers.get("Content-Length");
  const length = value === null ? NaN : Number(value);
  return Number.isSafeInteger(length) && length > 0 ? length : null;
};

const MAX_DOWNLOAD_BYTES = 512 * 1024 * 1024;

const tooLarge = (): TrajectoryDownloadError =>
  new TrajectoryDownloadError({ kind: "client", messageKey: "errors.download.too_large" });

// Grows geometrically up to the cap, so an unknown length never holds a chunk list plus its joined copy.
const grow = (buffer: Uint8Array<ArrayBuffer>, needed: number): Uint8Array<ArrayBuffer> => {
  const next = new Uint8Array(Math.min(MAX_DOWNLOAD_BYTES, Math.max(needed, buffer.byteLength * 2)));
  next.set(buffer);
  return next;
};

// Reads the whole body into memory; the caller owns the result. An aborted signal rejects with the fetch/reader AbortError.
const downloadTrajectory = async (url: string, { signal, onProgress }: DownloadOptions = {}): Promise<Uint8Array> => {
  const response = await fetch(url, { signal, credentials: "same-origin" });
  if (!response.ok) {
    const problem: unknown = await response.json().catch(() => undefined);
    throw new TrajectoryDownloadError(
      isProblem(problem) ? problem : { kind: "http", status: response.status, messageKey: "errors.http" },
      parseRetryAfter(response.headers.get("Retry-After")),
    );
  }
  const totalBytes = parseContentLength(response);
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    onProgress?.({ receivedBytes: bytes.byteLength, totalBytes: bytes.byteLength });
    return bytes;
  }
  if (totalBytes !== null && totalBytes > MAX_DOWNLOAD_BYTES) {
    void response.body.cancel().catch(() => undefined);
    throw tooLarge();
  }
  const reader = response.body.getReader();
  // A declared length is only a hint: a body that overruns it falls back to the capped growth path.
  let buffer = new Uint8Array(totalBytes ?? 0);
  let receivedBytes = 0;
  onProgress?.({ receivedBytes, totalBytes });
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const end = receivedBytes + value.byteLength;
      if (end > MAX_DOWNLOAD_BYTES) throw tooLarge();
      if (end > buffer.byteLength) buffer = grow(buffer, end);
      buffer.set(value, receivedBytes);
      receivedBytes = end;
      onProgress?.({ receivedBytes, totalBytes });
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return receivedBytes === buffer.byteLength ? buffer : buffer.slice(0, receivedBytes);
};

export { downloadTrajectory, TrajectoryDownloadError };
export type { DownloadProgress };
