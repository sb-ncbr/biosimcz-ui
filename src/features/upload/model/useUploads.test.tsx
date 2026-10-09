import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useUploads } from "./useUploads";
import { TransportFailure, type UploadTransport } from "./xhrTransport";

const transportWith = (overrides: Partial<UploadTransport> = {}): UploadTransport => ({
  init: () => Promise.resolve(),
  putContent: async (_d, _k, _f, { onProgress }) => onProgress(1),
  commit: () => Promise.resolve(),
  parse: () => Promise.resolve({ status: "unsupported", fields: [] }),
  remove: () => Promise.resolve(),
  ...overrides,
});

const file = (name: string, content = "abc") => new File([content], name, { lastModified: 7 });
const statuses = (items: { key: string; status: string }[]) => Object.fromEntries(items.map((item) => [item.key, item.status]));

describe("useUploads", () => {
  it("uploads dropped files and finishes done; rejects bad ones without uploading", async () => {
    const init = vi.fn(() => Promise.resolve());
    const { result } = renderHook(() => useUploads("d1", { transport: transportWith({ init }) }));
    act(() => result.current.addFiles([file("topol.top"), file("evil.exe"), file("conf.gro")]));
    await waitFor(() => expect(result.current.summary.inFlight).toBe(0));
    expect(statuses(result.current.items)).toEqual({ "evil.exe": "rejected", "topol.top": "done", "conf.gro": "done" });
    expect(init).toHaveBeenCalledTimes(2);
  });

  it("retries a failed upload manually", async () => {
    let calls = 0;
    const putContent = vi.fn(() => (++calls === 1 ? Promise.reject(new TransportFailure("network")) : Promise.resolve()));
    const { result } = renderHook(() => useUploads("d1", { transport: transportWith({ putContent }) }));
    act(() => result.current.addFiles([file("topol.top")]));
    await waitFor(() => expect(result.current.items[0]?.status).toBe("failed"));
    act(() => result.current.retry(result.current.items[0]?.id ?? ""));
    await waitFor(() => expect(result.current.items[0]?.status).toBe("done"));
    expect(putContent).toHaveBeenCalledTimes(2);
  });

  it("limits concurrency to the configured number", async () => {
    let active = 0;
    let peak = 0;
    const putContent = async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
    };
    const { result } = renderHook(() => useUploads("d1", { concurrency: 2, transport: transportWith({ putContent }) }));
    act(() => result.current.addFiles(["a", "b", "c", "d", "e"].map((n) => file(`${n}.top`))));
    await waitFor(() => expect(result.current.summary.uploaded).toBe(5));
    expect(peak).toBe(2);
  });

  it("removes a done file on the server, and keeps the row with remove_failed when that fails", async () => {
    const remove = vi.fn().mockRejectedValueOnce(new TransportFailure("network")).mockResolvedValue(undefined);
    const { result } = renderHook(() => useUploads("d1", { transport: transportWith({ remove }) }));
    act(() => result.current.addFiles([file("topol.top")]));
    await waitFor(() => expect(result.current.items[0]?.status).toBe("done"));
    act(() => result.current.remove(result.current.items[0]?.id ?? ""));
    await waitFor(() => expect(result.current.items[0]?.status).toBe("remove_failed"));
    act(() => result.current.remove(result.current.items[0]?.id ?? ""));
    await waitFor(() => expect(result.current.items).toHaveLength(0));
    expect(remove).toHaveBeenCalledWith("d1", "topol.top");
  });

  it("cancels an in-flight upload when removed", async () => {
    let signal: AbortSignal | undefined;
    const putContent: UploadTransport["putContent"] = (_d, _k, _f, options) =>
      new Promise<void>((_resolve, reject) => {
        signal = options.signal;
        options.signal.addEventListener("abort", () => reject(new TransportFailure("aborted")));
      });
    const { result } = renderHook(() => useUploads("d1", { transport: transportWith({ putContent }) }));
    act(() => result.current.addFiles([file("topol.top")]));
    await waitFor(() => expect(result.current.items[0]?.status).toBe("uploading"));
    act(() => result.current.remove(result.current.items[0]?.id ?? ""));
    expect(signal?.aborted).toBe(true);
    expect(result.current.items).toHaveLength(0);
  });

  it("resumes an interrupted server file only when the same file is selected again", async () => {
    const putContent = vi.fn(() => Promise.resolve());
    const { result } = renderHook(() =>
      useUploads("d1", {
        initialFiles: [
          { key: "conf.gro", size: 3, status: "pending" },
          { key: "topol.top", size: 9, status: "completed" },
        ],
        transport: transportWith({ putContent }),
      }),
    );
    expect(statuses(result.current.items)).toEqual({ "conf.gro": "interrupted", "topol.top": "done" });
    const id = result.current.items[0]?.id ?? "";

    act(() => result.current.resume(id, file("conf.gro", "much longer content")));
    expect(result.current.items[0]?.resumeMismatch).toBe(true);
    expect(putContent).not.toHaveBeenCalled();

    act(() => result.current.resume(id, file("conf.gro", "abc")));
    await waitFor(() => expect(result.current.items[0]?.status).toBe("done"));
    expect(putContent).toHaveBeenCalledTimes(1);
  });

  it("warns on unload only while something is in flight", async () => {
    let release: () => void = () => undefined;
    const putContent = () => new Promise<void>((resolve) => (release = resolve));
    const { result } = renderHook(() => useUploads("d1", { transport: transportWith({ putContent }) }));
    const fire = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(fire()).toBe(false);
    act(() => result.current.addFiles([file("topol.top")]));
    await waitFor(() => expect(result.current.hasActive).toBe(true));
    expect(fire()).toBe(true);
    act(() => release());
    await waitFor(() => expect(result.current.hasActive).toBe(false));
    expect(fire()).toBe(false);
  });

  describe("offline", () => {
    const setOnline = (value: boolean) => Object.defineProperty(window.navigator, "onLine", { configurable: true, value });
    afterEach(() => setOnline(true));

    it("pauses running and queued uploads when the connection drops and resumes them on reconnect", async () => {
      const releases: (() => void)[] = [];
      const putContent: UploadTransport["putContent"] = (_d, _k, _f, options) =>
        new Promise<void>((resolve, reject) => {
          releases.push(resolve);
          options.signal.addEventListener("abort", () => reject(new TransportFailure("aborted")));
        });
      const { result } = renderHook(() => useUploads("d1", { concurrency: 1, transport: transportWith({ putContent }) }));
      act(() => result.current.addFiles([file("a.top"), file("b.top")]));
      await waitFor(() => expect(statuses(result.current.items)).toEqual({ "a.top": "uploading", "b.top": "queued" }));

      act(() => {
        setOnline(false);
        window.dispatchEvent(new Event("offline"));
      });
      expect(statuses(result.current.items)).toEqual({ "a.top": "paused", "b.top": "paused" });
      expect(result.current.hasActive).toBe(true);
      expect(result.current.summary.paused).toBe(2);

      act(() => {
        setOnline(true);
        window.dispatchEvent(new Event("online"));
      });
      // Concurrency is 1: whichever file restarts first uploads, the other waits its turn.
      await waitFor(() => expect(Object.values(statuses(result.current.items)).sort()).toEqual(["queued", "uploading"]));
      await waitFor(() => expect(releases.length).toBeGreaterThan(1));
      releases.at(-1)?.();
      await waitFor(() => expect(Object.values(statuses(result.current.items)).sort()).toEqual(["done", "uploading"]));
      releases.at(-1)?.();
      await waitFor(() => expect(result.current.summary.uploaded).toBe(2));
    });

    it("parks files dropped while offline instead of failing them", () => {
      setOnline(false);
      const init = vi.fn(() => Promise.resolve());
      const { result } = renderHook(() => useUploads("d1", { transport: transportWith({ init }) }));
      act(() => result.current.addFiles([file("a.top")]));
      expect(result.current.items[0]?.status).toBe("paused");
      expect(init).not.toHaveBeenCalled();
    });
  });

  it("replaces a stored file: deletes the old one, then uploads the new one under the same name", async () => {
    const remove = vi.fn(() => Promise.resolve());
    const init = vi.fn(() => Promise.resolve());
    const { result } = renderHook(() => useUploads("d1", { transport: transportWith({ remove, init }) }));
    act(() => result.current.addFiles([file("topol.top")]));
    await waitFor(() => expect(result.current.items[0]?.status).toBe("done"));
    act(() => result.current.replace(result.current.items[0]?.id ?? "", file("topol.top", "new content")));
    await waitFor(() => expect(init).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.items[0]?.status).toBe("done"));
    expect(remove).toHaveBeenCalledWith("d1", "topol.top");
    expect(result.current.items).toHaveLength(1);
  });
});
