"use client";

import { useCallback, useEffect, useRef } from "react";
import type { SaveOutcome } from "../api/draftClient";
import type { DraftEvent, DraftState } from "./draftMachine";
import { backoffDelayMs } from "./saveState";

const DEFAULT_DEBOUNCE_MS = 1500;

type AutosaveOptions = {
  state: DraftState;
  dispatch: (event: DraftEvent) => void;
  // Snapshots the current values, sends them and settles the mirror; the hook only drives timing and the machine.
  send: (request: { revision: number; keepalive: boolean }) => Promise<SaveOutcome>;
  debounceMs?: number;
  now?: () => number;
};

type Autosave = {
  // Saves now if anything is unsaved (step change, tab hidden, pagehide). Resolves when the request settles.
  flush: (options?: { keepalive?: boolean }) => Promise<void>;
  retryNow: () => void;
};

// Debounced autosave: restarts on every change, one request in flight, latest values win (the machine coalesces changes
// made during a request into one follow-up save), exponential backoff after failures, paused while offline.
const useAutosave = ({ state, dispatch, send, debounceMs = DEFAULT_DEBOUNCE_MS, now = Date.now }: AutosaveOptions): Autosave => {
  const latest = useRef({ state, send, now });
  useEffect(() => {
    latest.current = { state, send, now };
  });
  const inFlight = useRef<Promise<void> | null>(null);

  const save = useCallback(
    (keepalive: boolean): Promise<void> => {
      if (inFlight.current) return inFlight.current;
      const { state: current, send: sendNow, now: clock } = latest.current;
      if ((current.status !== "dirty" && current.status !== "save-failed") || current.offline) return Promise.resolve();

      dispatch({ type: "SAVE_STARTED" });
      const request = (async () => {
        try {
          const outcome = await sendNow({ revision: current.revision, keepalive });
          if (outcome.kind === "saved") dispatch({ type: "SAVE_SUCCEEDED", revision: outcome.revision, at: clock() });
          else if (outcome.kind === "conflict") dispatch({ type: "SAVE_CONFLICT" });
          else if (outcome.kind === "session-expired") dispatch({ type: "SESSION_EXPIRED" });
          else dispatch({ type: "SAVE_FAILED", code: outcome.code });
        } catch {
          dispatch({ type: "SAVE_FAILED", code: "unexpected" });
        }
      })().finally(() => {
        inFlight.current = null;
      });
      inFlight.current = request;
      return request;
    },
    [dispatch],
  );

  useEffect(() => {
    if (state.offline) return;
    let delay: number | null = null;
    if (state.status === "dirty") delay = debounceMs;
    else if (state.status === "save-failed") delay = backoffDelayMs(state.failures);
    if (delay === null) return;
    const timer = setTimeout(() => void save(false), delay);
    return () => clearTimeout(timer);
  }, [state.status, state.changes, state.failures, state.offline, debounceMs, save]);

  const flush = useCallback((options?: { keepalive?: boolean }) => save(options?.keepalive === true), [save]);
  const retryNow = useCallback(() => dispatch({ type: "RETRY_NOW" }), [dispatch]);

  return { flush, retryNow };
};

export { useAutosave };
export type { Autosave, AutosaveOptions };
