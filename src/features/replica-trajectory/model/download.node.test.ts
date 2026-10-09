import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadTrajectory, TrajectoryDownloadError } from "./download";

const streamOf = (chunks: Uint8Array[]): ReadableStream<Uint8Array> => {
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      const chunk = chunks[index++];
      if (chunk) controller.enqueue(chunk);
      else controller.close();
    },
  });
};

const respond = (body: ReadableStream<Uint8Array>, headers: Record<string, string> = {}) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(body, { status: 200, headers }));

afterEach(() => vi.restoreAllMocks());

describe("downloadTrajectory", () => {
  it("reports percent-ready progress when Content-Length is known and returns joined bytes", async () => {
    respond(streamOf([new Uint8Array([1, 2]), new Uint8Array([3, 4, 5])]), { "Content-Length": "5" });
    const onProgress = vi.fn();
    const bytes = await downloadTrajectory("/bff/records/MD-A.1/trajectory", { onProgress });
    expect([...bytes]).toEqual([1, 2, 3, 4, 5]);
    expect(onProgress).toHaveBeenLastCalledWith({ receivedBytes: 5, totalBytes: 5 });
    expect(onProgress).toHaveBeenCalledWith({ receivedBytes: 2, totalBytes: 5 });
  });

  it("reports bytes only when the length is unknown", async () => {
    respond(streamOf([new Uint8Array([1, 2, 3])]));
    const onProgress = vi.fn();
    await downloadTrajectory("/bff/records/MD-A.1/trajectory", { onProgress });
    expect(onProgress).toHaveBeenLastCalledWith({ receivedBytes: 3, totalBytes: null });
  });

  it("does not trust Content-Length on an encoded body", async () => {
    respond(streamOf([new Uint8Array([1])]), { "Content-Length": "99", "Content-Encoding": "gzip" });
    const onProgress = vi.fn();
    await downloadTrajectory("/bff/records/MD-A.1/trajectory", { onProgress });
    expect(onProgress).toHaveBeenLastCalledWith({ receivedBytes: 1, totalBytes: null });
  });

  it("rejects when the signal is aborted while reading", async () => {
    const controller = new AbortController();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const signal = init?.signal;
      const body = new ReadableStream<Uint8Array>({
        start(stream) {
          signal?.addEventListener("abort", () => stream.error(new DOMException("Aborted", "AbortError")));
        },
      });
      return new Response(body, { status: 200 });
    });
    const pending = downloadTrajectory("/bff/records/MD-A.1/trajectory", { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });

  it("throws the BFF problem with the Retry-After value", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ kind: "http", status: 429, messageKey: "errors.http.too_many_streams" }), {
        status: 429,
        headers: { "Content-Type": "application/problem+json", "Retry-After": "5" },
      }),
    );
    const error = await downloadTrajectory("/x").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(TrajectoryDownloadError);
    expect(error).toMatchObject({ problem: { messageKey: "errors.http.too_many_streams" }, retryAfterSeconds: 5 });
  });

  it("falls back to a generic problem for a non-JSON error body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("boom", { status: 502 }));
    await expect(downloadTrajectory("/x")).rejects.toMatchObject({ problem: { messageKey: "errors.http", status: 502 } });
  });

  it("rejects a declared length over 512 MiB with the fixed key and cancels the body", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ pull: (c) => c.enqueue(new Uint8Array([1])), cancel });
    respond(body, { "Content-Length": String(512 * 1024 * 1024 + 1) });
    const error = await downloadTrajectory("/x").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(TrajectoryDownloadError);
    expect(error).toMatchObject({ problem: { messageKey: "errors.download.too_large" } });
    expect(cancel).toHaveBeenCalled();
  });

  it("keeps the bytes when the body overruns a too-small Content-Length", async () => {
    respond(streamOf([new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])]), { "Content-Length": "2" });
    expect([...(await downloadTrajectory("/x"))]).toEqual([1, 2, 3, 4, 5]);
  });

  it("returns only the received bytes when the body is shorter than Content-Length", async () => {
    respond(streamOf([new Uint8Array([1, 2])]), { "Content-Length": "9" });
    expect([...(await downloadTrajectory("/x"))]).toEqual([1, 2]);
  });

  it("propagates a read failure", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error("boom"));
      },
      cancel,
    });
    respond(body);
    await expect(downloadTrajectory("/x")).rejects.toThrow("boom");
  });
});
