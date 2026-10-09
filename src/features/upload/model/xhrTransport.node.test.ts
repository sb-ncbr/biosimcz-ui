import { describe, expect, it, vi } from "vitest";
import { runUpload } from "./pipeline";
import { initialUploadState, uploadReducer, type UploadAction, type UploadState } from "./uploadMachine";
import { createXhrTransport, TransportFailure, type UploadTransport } from "./xhrTransport";

type Script = { status?: number; error?: boolean; progress?: number[] };

// Minimal XMLHttpRequest stand-in: each send() consumes the next scripted outcome.
const fakeXhr = (script: Script[]) => {
  const opened: { method: string; url: string; headers: Record<string, string> }[] = [];
  const aborted: number[] = [];
  const create = () => {
    const outcome = script.shift() ?? { status: 200 };
    const record = { method: "", url: "", headers: {} as Record<string, string> };
    const xhr = {
      upload: {} as { onprogress?: (event: { lengthComputable: boolean; loaded: number }) => void },
      status: 0,
      onload: undefined as (() => void) | undefined,
      onerror: undefined as (() => void) | undefined,
      onabort: undefined as (() => void) | undefined,
      open(method: string, url: string) {
        record.method = method;
        record.url = url;
        opened.push(record);
      },
      setRequestHeader(name: string, value: string) {
        record.headers[name] = value;
      },
      send() {
        queueMicrotask(() => {
          for (const loaded of outcome.progress ?? []) xhr.upload.onprogress?.({ lengthComputable: true, loaded });
          if (outcome.error) xhr.onerror?.();
          else if (outcome.status !== undefined) {
            xhr.status = outcome.status;
            xhr.onload?.();
          }
          // No status and no error: stays pending until aborted.
        });
      },
      abort() {
        aborted.push(1);
        xhr.onabort?.();
      },
    };
    return xhr as unknown as XMLHttpRequest;
  };
  return { create, opened, aborted };
};

const blob = new Blob(["hello"]);
const options = (signal = new AbortController().signal) => ({ signal, onProgress: vi.fn() });

describe("createXhrTransport.putContent", () => {
  it("PUTs an encoded URL as octet-stream and reports progress", async () => {
    const xhr = fakeXhr([{ status: 204, progress: [2, 5] }]);
    const transport = createXhrTransport({ createXhr: xhr.create });
    const opts = options();
    await transport.putContent("draft-1", "my file #1.top", blob, opts);
    expect(xhr.opened[0]).toMatchObject({
      method: "PUT",
      url: "/bff/depositions/draft-1/files/my%20file%20%231.top/content",
      headers: { "Content-Type": "application/octet-stream" },
    });
    expect(opts.onProgress.mock.calls.map((call) => call[0])).toEqual([2, 5]);
  });

  it("retries network errors and 503 with backoff, then succeeds", async () => {
    const xhr = fakeXhr([{ error: true }, { status: 503 }, { status: 204 }]);
    const sleep = vi.fn(() => Promise.resolve());
    const transport = createXhrTransport({ createXhr: xhr.create, retries: 2, sleep });
    const opts = options();
    await transport.putContent("d", "a.top", blob, opts);
    expect(xhr.opened).toHaveLength(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    // Progress is reset before each retry.
    expect(opts.onProgress.mock.calls.filter((call) => call[0] === 0)).toHaveLength(2);
  });

  it("gives up after the retry budget and reports the failure", async () => {
    const xhr = fakeXhr([{ error: true }, { error: true }]);
    const transport = createXhrTransport({ createXhr: xhr.create, retries: 1, sleep: () => Promise.resolve() });
    await expect(transport.putContent("d", "a.top", blob, options())).rejects.toMatchObject({ kind: "network" });
    expect(xhr.opened).toHaveLength(2);
  });

  it("does not retry 4xx or 500", async () => {
    for (const status of [413, 500]) {
      const xhr = fakeXhr([{ status }, { status: 204 }]);
      const transport = createXhrTransport({ createXhr: xhr.create, retries: 2, sleep: () => Promise.resolve() });
      await expect(transport.putContent("d", "a.top", blob, options())).rejects.toMatchObject({ kind: "http", status });
      expect(xhr.opened).toHaveLength(1);
    }
  });

  it("aborts the request when the signal fires and does not retry", async () => {
    const xhr = fakeXhr([{}, { status: 204 }]);
    const transport = createXhrTransport({ createXhr: xhr.create, retries: 2, sleep: () => Promise.resolve() });
    const controller = new AbortController();
    const pending = transport.putContent("d", "a.top", blob, options(controller.signal));
    await Promise.resolve();
    controller.abort();
    await expect(pending).rejects.toMatchObject({ kind: "aborted" });
    expect(xhr.aborted).toHaveLength(1);
    expect(xhr.opened).toHaveLength(1);
  });
});

// Scripted UploadTransport for the pipeline.
const fakeTransport = (overrides: Partial<UploadTransport> = {}): UploadTransport => ({
  init: () => Promise.resolve(),
  putContent: async (_d, _k, _f, { onProgress }) => {
    onProgress(2);
    onProgress(5);
  },
  commit: () => Promise.resolve(),
  parse: () => Promise.resolve({ status: "ok", detectedRole: "topology", fields: [{ path: "system.engine.name", value: "GROMACS" }] }),
  remove: () => Promise.resolve(),
  ...overrides,
});

const drive = async (transport: UploadTransport, signal = new AbortController().signal) => {
  let state: UploadState = uploadReducer(initialUploadState(), {
    type: "dropped",
    files: [{ id: "a", name: "topol.top", size: 5, lastModified: 1 }],
  });
  const seen: string[] = [];
  const emit = (action: UploadAction) => {
    seen.push(action.type);
    state = uploadReducer(state, action);
  };
  await runUpload({ id: "a", draftId: "d", key: "topol.top", file: blob }, transport, emit, signal);
  return { state, seen };
};

describe("runUpload", () => {
  it("runs every stage and ends done with parse data and the detected role", async () => {
    const { state, seen } = await drive(fakeTransport());
    expect(seen).toEqual(["started", "initiated", "progress", "progress", "uploaded", "committed", "parsed"]);
    expect(state.items[0]).toMatchObject({ status: "done", role: "topology", parse: { status: "ok" } });
  });

  it("maps failures: network stays retryable, 413 is rejected, 401 interrupts", async () => {
    const cases: [TransportFailure, string, string][] = [
      [new TransportFailure("network"), "failed", "network"],
      [new TransportFailure("http", 503), "failed", "network"],
      [new TransportFailure("http", 409), "failed", "network"],
      [new TransportFailure("http", 413), "failed", "rejected"],
      [new TransportFailure("http", 401), "interrupted", "auth"],
    ];
    for (const [error, status, reason] of cases) {
      const { state } = await drive(fakeTransport({ putContent: () => Promise.reject(error) }));
      expect(state.items[0]).toMatchObject({ status, failReason: reason });
    }
  });

  it("a parse failure does not fail the upload", async () => {
    const { state } = await drive(fakeTransport({ parse: () => Promise.reject(new TransportFailure("http", 404)) }));
    expect(state.items[0]).toMatchObject({ status: "done" });
    expect(state.items[0]?.parse).toBeUndefined();
  });

  it("emits nothing after an abort", async () => {
    const controller = new AbortController();
    const { seen } = await drive(
      fakeTransport({
        init: () => {
          controller.abort();
          return Promise.reject(new TransportFailure("aborted"));
        },
      }),
      controller.signal,
    );
    expect(seen).toEqual(["started"]);
  });
});
