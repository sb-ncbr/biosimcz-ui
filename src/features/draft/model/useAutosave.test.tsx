import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SaveOutcome } from "../api/draftClient";
import { createInitialState, draftReducer, type DraftEvent } from "./draftMachine";
import { toSaveState } from "./saveState";
import { useAutosave } from "./useAutosave";
import { useReducer } from "react";

type Send = (request: { revision: number; keepalive: boolean }) => Promise<SaveOutcome>;

const setup = (send: Send, savedAt = 0) =>
  renderHook(() => {
    const [state, dispatch] = useReducer(draftReducer, createInitialState({ revision: 1, savedAt }));
    const autosave = useAutosave({ state, dispatch, send, now: () => Date.now() });
    return { state, dispatch: dispatch as (event: DraftEvent) => void, ...autosave };
  });

const saved = (revision: number): SaveOutcome => ({ kind: "saved", revision, updatedAt: "2026-09-30T00:00:00Z" });

const tick = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

const change = (hook: ReturnType<typeof setup>) => act(() => hook.result.current.dispatch({ type: "CHANGE" }));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useAutosave", () => {
  it("waits 1500 ms after the last change, then saves once with the current revision", async () => {
    const send = vi.fn<Send>().mockResolvedValue(saved(2));
    const hook = setup(send);
    change(hook);
    await tick(1499);
    expect(send).not.toHaveBeenCalled();
    await tick(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ revision: 1, keepalive: false });
    expect(hook.result.current.state).toMatchObject({ status: "editing", revision: 2, unsaved: false });
  });

  it("restarts the debounce on every change", async () => {
    const send = vi.fn<Send>().mockResolvedValue(saved(2));
    const hook = setup(send);
    change(hook);
    await tick(1000);
    change(hook);
    await tick(1000);
    expect(send).not.toHaveBeenCalled();
    await tick(500);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("keeps one request in flight and sends a follow-up for changes made meanwhile", async () => {
    let finish: (outcome: SaveOutcome) => void = () => undefined;
    const send = vi
      .fn<Send>()
      .mockImplementationOnce(() => new Promise<SaveOutcome>((resolve) => (finish = resolve)))
      .mockResolvedValue(saved(3));
    const hook = setup(send);
    change(hook);
    await tick(1500);
    expect(hook.result.current.state.status).toBe("saving");
    change(hook);
    await tick(5000);
    expect(send).toHaveBeenCalledTimes(1);
    await act(async () => finish(saved(2)));
    expect(hook.result.current.state).toMatchObject({ status: "dirty", revision: 2, unsaved: true });
    await tick(1500);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith({ revision: 2, keepalive: false });
    expect(hook.result.current.state).toMatchObject({ status: "editing", revision: 3 });
  });

  it("retries with backoff after failures (2 s, 5 s, 10 s, 30 s) and recovers", async () => {
    const send = vi
      .fn<Send>()
      .mockResolvedValueOnce({ kind: "failed", code: "network" })
      .mockResolvedValueOnce({ kind: "failed", code: "network" })
      .mockResolvedValueOnce({ kind: "failed", code: "http" })
      .mockResolvedValueOnce({ kind: "failed", code: "http" })
      .mockResolvedValue(saved(2));
    const hook = setup(send);
    change(hook);
    await tick(1500);
    expect(send).toHaveBeenCalledTimes(1);
    expect(toSaveState(hook.result.current.state, 0).kind).toBe("retrying");

    await tick(1999);
    expect(send).toHaveBeenCalledTimes(1);
    await tick(1);
    expect(send).toHaveBeenCalledTimes(2);

    await tick(4999);
    expect(send).toHaveBeenCalledTimes(2);
    await tick(1);
    expect(send).toHaveBeenCalledTimes(3);

    await tick(10_000);
    expect(send).toHaveBeenCalledTimes(4);
    expect(toSaveState(hook.result.current.state, 0).kind).toBe("failed");

    await tick(29_999);
    expect(send).toHaveBeenCalledTimes(4);
    await tick(1);
    expect(send).toHaveBeenCalledTimes(5);
    expect(hook.result.current.state).toMatchObject({ status: "editing", failures: 0, unsaved: false });
  });

  it("retryNow skips the backoff", async () => {
    const send = vi.fn<Send>().mockResolvedValueOnce({ kind: "failed", code: "network" }).mockResolvedValue(saved(2));
    const hook = setup(send);
    change(hook);
    await tick(1500);
    act(() => hook.result.current.retryNow());
    await tick(0);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("does not send while offline and saves as soon as the connection is back", async () => {
    const send = vi.fn<Send>().mockResolvedValue(saved(2));
    const hook = setup(send);
    act(() => hook.result.current.dispatch({ type: "OFFLINE" }));
    change(hook);
    await tick(10_000);
    expect(send).not.toHaveBeenCalled();
    expect(toSaveState(hook.result.current.state, 0).kind).toBe("offline");
    act(() => hook.result.current.dispatch({ type: "ONLINE" }));
    await tick(1500);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("flush saves immediately, uses keepalive on request, and is a no-op when nothing changed", async () => {
    const send = vi.fn<Send>().mockResolvedValue(saved(2));
    const hook = setup(send);
    await act(async () => hook.result.current.flush());
    expect(send).not.toHaveBeenCalled();
    change(hook);
    await act(async () => hook.result.current.flush({ keepalive: true }));
    expect(send).toHaveBeenCalledWith({ revision: 1, keepalive: true });
    expect(hook.result.current.state.status).toBe("editing");
    await tick(5000);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("turns a conflict, an expired session and a thrown error into the matching machine state", async () => {
    for (const [outcome, status] of [
      [{ kind: "conflict" } as const, "conflict"],
      [{ kind: "session-expired" } as const, "session-expired"],
    ] as const) {
      const hook = setup(vi.fn<Send>().mockResolvedValue(outcome));
      change(hook);
      await tick(1500);
      expect(hook.result.current.state.status).toBe(status);
      await tick(60_000);
    }
    const throwing = vi.fn<Send>().mockRejectedValue(new Error("boom"));
    const hook = setup(throwing);
    change(hook);
    await tick(1500);
    expect(hook.result.current.state).toMatchObject({ status: "save-failed", errorCode: "unexpected" });
    hook.unmount();
  });

  it("stops the timer on unmount", async () => {
    const send = vi.fn<Send>().mockResolvedValue(saved(2));
    const hook = setup(send);
    change(hook);
    hook.unmount();
    await tick(5000);
    expect(send).not.toHaveBeenCalled();
  });
});
