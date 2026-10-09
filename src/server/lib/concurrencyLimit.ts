import "server-only";

type Release = () => void;

type ConcurrencyLimiter = { tryAcquire: () => Release | null; readonly active: number };

// In-process only: each server instance counts its own streams. Per-client limits belong to the proxy.
const createConcurrencyLimiter = (max: number): ConcurrencyLimiter => {
  let active = 0;
  return {
    tryAcquire() {
      if (active >= max) return null;
      active++;
      let released = false;
      // Idempotent, because completion, error and abort can all fire for the same stream.
      return () => {
        if (released) return;
        released = true;
        active--;
      };
    },
    get active() {
      return active;
    },
  };
};

// Passes the body through unchanged and calls release when it ends, errors or is cancelled by the consumer.
const releaseWhenDone = (body: ReadableStream<Uint8Array>, release: Release): ReadableStream<Uint8Array> => {
  const reader = body.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          release();
          controller.close();
        } else controller.enqueue(value);
      } catch (error) {
        release();
        controller.error(error);
      }
    },
    async cancel(reason) {
      release();
      await reader.cancel(reason).catch(() => undefined);
    },
  });
};

export { createConcurrencyLimiter, releaseWhenDone };
