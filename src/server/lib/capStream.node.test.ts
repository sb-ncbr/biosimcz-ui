import { describe, expect, it } from "vitest";
import { capStream, forwardableLength, mediaType } from "./capStream";

const drain = async (stream: ReadableStream<Uint8Array>): Promise<number> => {
  let total = 0;
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return total;
    total += value.byteLength;
  }
};

const streamOf = (...sizes: number[]): ReadableStream<Uint8Array> =>
  new ReadableStream({
    start(controller) {
      for (const size of sizes) controller.enqueue(new Uint8Array(size));
      controller.close();
    },
  });

describe("capStream", () => {
  it("passes a body at the limit", async () => {
    expect(await drain(streamOf(5, 5).pipeThrough(capStream(10)))).toBe(10);
  });

  it("errors with 413 once the limit is crossed", async () => {
    await expect(drain(streamOf(6, 6).pipeThrough(capStream(10)))).rejects.toMatchObject({ status: 413, code: "too_large" });
  });
});

describe("capStream deadlines", () => {
  const neverEnding = (): TransformStream<Uint8Array, Uint8Array> => new TransformStream();

  it("errors with a timeout when no bytes arrive for the idle period", async () => {
    const source = neverEnding();
    const reader = source.readable.pipeThrough(capStream(1000, { idleMs: 20, totalMs: 10_000 })).getReader();
    await expect(reader.read()).rejects.toMatchObject({ kind: "timeout", code: "stream_stalled" });
  });

  it("errors at the total deadline even while bytes keep flowing", async () => {
    const source = neverEnding();
    const writer = source.writable.getWriter();
    const ticker = setInterval(() => void writer.write(new Uint8Array(1)).catch(() => undefined), 5);
    const reader = source.readable.pipeThrough(capStream(1_000_000, { idleMs: 1000, totalMs: 50 })).getReader();
    try {
      await expect(
        (async () => {
          for (;;) await reader.read();
        })(),
      ).rejects.toMatchObject({ code: "stream_stalled" });
    } finally {
      clearInterval(ticker);
    }
  });

  it("does not fire for a body that finishes in time", async () => {
    expect(await drain(streamOf(5, 5).pipeThrough(capStream(10, { idleMs: 20, totalMs: 100 })))).toBe(10);
    await new Promise((resolve) => setTimeout(resolve, 40));
  });
});

describe("forwardableLength", () => {
  it("forwards the length of an unencoded body", () => {
    expect(forwardableLength(new Response("x", { headers: { "content-length": "1" } }))).toBe("1");
    expect(forwardableLength(new Response("x", { headers: { "content-length": "1", "content-encoding": "identity" } }))).toBe("1");
  });

  it("drops the length of an encoded body", () => {
    expect(forwardableLength(new Response("x", { headers: { "content-length": "1", "content-encoding": "gzip" } }))).toBeNull();
  });
});

describe("mediaType", () => {
  it("lowercases and strips parameters", () => {
    expect(mediaType(new Response("x", { headers: { "content-type": "Application/JSON; charset=utf-8" } }))).toBe("application/json");
    expect(mediaType(new Response(null))).toBe("");
  });
});
