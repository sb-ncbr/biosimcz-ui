import "server-only";
import { ApiError } from "../http/errors";

const tooLarge = (): ApiError => new ApiError({ kind: "http", backend: "mdposit", status: 413, code: "too_large" });

const stalled = (): ApiError => new ApiError({ kind: "timeout", backend: "mdposit", code: "stream_stalled" });

type StreamDeadlines = { idleMs: number; totalMs: number };

// Errors the stream once the cap is crossed, so a missing or lying Content-Length cannot make us relay an unbounded body.
// With deadlines it also errors when no bytes pass for idleMs or the whole transfer exceeds totalMs; a stalled upstream or a
// client that stops reading (backpressure) both look like silence here, so neither can hold the stream open forever.
const capStream = (limit: number, deadlines?: StreamDeadlines): TransformStream<Uint8Array, Uint8Array> => {
  let total = 0;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let totalTimer: ReturnType<typeof setTimeout> | undefined;
  let rearm = (): void => undefined;
  const clear = (): void => {
    clearTimeout(idleTimer);
    clearTimeout(totalTimer);
  };
  return new TransformStream({
    start(controller) {
      if (!deadlines) return;
      const fail = (): void => {
        clear();
        try {
          controller.error(stalled());
        } catch {
          // Already closed or errored.
        }
      };
      const armIdle = (): void => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(fail, deadlines.idleMs);
        idleTimer.unref?.();
      };
      rearm = armIdle;
      armIdle();
      totalTimer = setTimeout(fail, deadlines.totalMs);
      totalTimer.unref?.();
    },
    transform(chunk, controller) {
      rearm();
      total += chunk.byteLength;
      if (total > limit) {
        clear();
        controller.error(tooLarge());
      } else controller.enqueue(chunk);
    },
    flush: clear,
    cancel: clear,
  } as Transformer<Uint8Array, Uint8Array>);
};

// fetch decompresses encoded bodies, so the upstream Content-Length would describe the compressed size and truncate or hang
// the browser download. Only an unencoded response may forward it.
const forwardableLength = (response: Response): string | null => {
  const encoding = response.headers.get("content-encoding")?.trim().toLowerCase();
  if (encoding && encoding !== "identity") return null;
  return response.headers.get("content-length");
};

const mediaType = (response: Response): string => response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";

export { capStream, forwardableLength, mediaType, tooLarge };
export type { StreamDeadlines };
