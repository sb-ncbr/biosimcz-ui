import { describe, expect, it } from "vitest";
import { createConcurrencyLimiter, releaseWhenDone } from "./concurrencyLimit";

const streamOf = (...chunks: number[]): ReadableStream<Uint8Array> =>
  new ReadableStream({
    start(controller) {
      for (const size of chunks) controller.enqueue(new Uint8Array(size));
      controller.close();
    },
  });

describe("createConcurrencyLimiter", () => {
  it("refuses beyond max and admits again after release", () => {
    const limiter = createConcurrencyLimiter(2);
    const a = limiter.tryAcquire();
    limiter.tryAcquire();
    expect(limiter.tryAcquire()).toBeNull();
    a?.();
    expect(limiter.active).toBe(1);
    expect(limiter.tryAcquire()).not.toBeNull();
  });

  it("counts a double release once", () => {
    const limiter = createConcurrencyLimiter(1);
    const release = limiter.tryAcquire();
    release?.();
    release?.();
    expect(limiter.active).toBe(0);
    expect(limiter.tryAcquire()).not.toBeNull();
    expect(limiter.tryAcquire()).toBeNull();
  });
});

describe("releaseWhenDone", () => {
  it("releases when the body completes", async () => {
    const limiter = createConcurrencyLimiter(1);
    const body = releaseWhenDone(streamOf(3, 4), limiter.tryAcquire()!);
    expect(limiter.active).toBe(1);
    expect((await new Response(body).arrayBuffer()).byteLength).toBe(7);
    expect(limiter.active).toBe(0);
  });

  it("releases when the body errors", async () => {
    const limiter = createConcurrencyLimiter(1);
    const failing = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error("boom"));
      },
    });
    await expect(new Response(releaseWhenDone(failing, limiter.tryAcquire()!)).arrayBuffer()).rejects.toThrow();
    expect(limiter.active).toBe(0);
  });

  it("releases when the consumer cancels", async () => {
    const limiter = createConcurrencyLimiter(1);
    const body = releaseWhenDone(streamOf(1), limiter.tryAcquire()!);
    await body.cancel();
    expect(limiter.active).toBe(0);
  });
});
