import { describe, expect, it } from "vitest";
import { UploadQueue } from "./queue";

type Deferred = { resolve: () => void; reject: (error: Error) => void; signal: AbortSignal };

// Jobs stay running until the test resolves them.
const controlled = (concurrency: number) => {
  const started: string[] = [];
  const running = new Map<string, Deferred>();
  const queue = new UploadQueue<{ id: string }>({
    concurrency,
    run: (job, signal) =>
      new Promise<void>((resolve, reject) => {
        started.push(job.id);
        running.set(job.id, { resolve, reject, signal });
        signal.addEventListener("abort", () => resolve());
      }),
  });
  return { queue, started, running };
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("UploadQueue", () => {
  it("never runs more than the concurrency limit and starts jobs in order", async () => {
    const { queue, started, running } = controlled(3);
    for (const id of ["a", "b", "c", "d", "e"]) queue.enqueue({ id });
    expect(started).toEqual(["a", "b", "c"]);
    expect(queue.activeCount).toBe(3);
    expect(queue.pendingCount).toBe(2);

    running.get("b")?.resolve();
    await tick();
    expect(started).toEqual(["a", "b", "c", "d"]);
    expect(queue.activeCount).toBe(3);

    for (const id of ["a", "c", "d", "e"]) {
      running.get(id)?.resolve();
      await tick();
    }
    await queue.idle();
    expect(started).toEqual(["a", "b", "c", "d", "e"]);
    expect(queue.activeCount).toBe(0);
  });

  it("frees the slot when a job rejects", async () => {
    const { queue, started, running } = controlled(1);
    queue.enqueue({ id: "a" });
    queue.enqueue({ id: "b" });
    running.get("a")?.reject(new Error("boom"));
    await tick();
    expect(started).toEqual(["a", "b"]);
  });

  it("cancels a waiting job without running it", async () => {
    const { queue, started, running } = controlled(1);
    queue.enqueue({ id: "a" });
    queue.enqueue({ id: "b" });
    expect(queue.cancel("b")).toBe(true);
    running.get("a")?.resolve();
    await queue.idle();
    expect(started).toEqual(["a"]);
  });

  it("aborts a running job's signal and starts the next one", async () => {
    const { queue, started, running } = controlled(1);
    queue.enqueue({ id: "a" });
    queue.enqueue({ id: "b" });
    const signal = running.get("a")?.signal;
    expect(queue.cancel("a")).toBe(true);
    expect(signal?.aborted).toBe(true);
    await tick();
    expect(started).toEqual(["a", "b"]);
    expect(queue.cancel("missing")).toBe(false);
  });

  it("ignores a duplicate enqueue of a live job id, and accepts it again after it finished", async () => {
    const { queue, started, running } = controlled(2);
    queue.enqueue({ id: "a" });
    queue.enqueue({ id: "a" });
    expect(started).toEqual(["a"]);
    running.get("a")?.resolve();
    await queue.idle();
    queue.enqueue({ id: "a" });
    expect(started).toEqual(["a", "a"]);
  });

  it("cancelAll aborts running jobs and drops waiting ones", async () => {
    const { queue, started, running } = controlled(1);
    queue.enqueue({ id: "a" });
    queue.enqueue({ id: "b" });
    queue.cancelAll();
    await queue.idle();
    expect(running.get("a")?.signal.aborted).toBe(true);
    expect(started).toEqual(["a"]);
  });

  it("rejects an invalid concurrency", () => {
    expect(() => new UploadQueue({ concurrency: 0, run: () => Promise.resolve() })).toThrow(RangeError);
  });
});
