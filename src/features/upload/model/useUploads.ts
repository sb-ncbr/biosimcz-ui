"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { UPLOAD_LIMITS } from "@/shared/config/client";
import { rejectionFor } from "../lib/validate";
import { runUpload, type UploadJob } from "./pipeline";
import { UploadQueue } from "./queue";
import {
  initialUploadState,
  isInFlight,
  summarize,
  uploadReducer,
  type ServerFile,
  type UploadAction,
  type UploadItem,
  type UploadSummary,
} from "./uploadMachine";
import { createXhrTransport, type UploadTransport } from "./xhrTransport";

type UseUploadsOptions = {
  accept?: readonly string[];
  maxBytes?: number;
  concurrency?: number;
  // Files the server already knows about (draft read, E-D1): completed ones are done, pending ones interrupted.
  initialFiles?: readonly ServerFile[];
  transport?: UploadTransport;
};

type UseUploads = {
  items: UploadItem[];
  summary: UploadSummary;
  // True while any file is not safely stored; drives the beforeunload warning and the Publish rule.
  hasActive: boolean;
  accept: readonly string[];
  maxBytes: number;
  addFiles: (files: readonly File[]) => void;
  retry: (id: string) => void;
  retryAll: () => void;
  remove: (id: string) => void;
  // Re-selecting an interrupted file: same name, size and lastModified resumes, anything else flags a mismatch.
  resume: (id: string, file: File) => void;
  // Swaps a stored file for another one (e.g. an unreadable topology): deletes the old one, then uploads the new one.
  replace: (id: string, file: File) => void;
};

const isOnline = (): boolean => typeof navigator === "undefined" || navigator.onLine;

const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `f-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const useUploads = (draftId: string, options: UseUploadsOptions = {}): UseUploads => {
  const {
    accept = UPLOAD_LIMITS.systemExtensions,
    maxBytes = UPLOAD_LIMITS.maxBytes,
    concurrency = UPLOAD_LIMITS.concurrency,
    initialFiles,
    transport: injected,
  } = options;

  const [state, dispatch] = useReducer(uploadReducer, initialFiles, initialUploadState);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Fixed for the lifetime of the hook: a new queue or transport per render would abort running uploads.
  const [transport] = useState<UploadTransport>(() => injected ?? createXhrTransport());
  const [queue] = useState(
    () =>
      new UploadQueue<UploadJob>({
        concurrency,
        run: (job, signal) => runUpload(job, transport, dispatch as (action: UploadAction) => void, signal),
      }),
  );
  const files = useRef(new Map<string, File>());

  const enqueue = useCallback(
    (item: UploadItem) => {
      const file = files.current.get(item.id);
      if (!file) return;
      // Offline: park the row instead of letting the request fail; it starts when the connection is back.
      if (!isOnline()) {
        dispatch({ type: "paused", id: item.id });
        return;
      }
      queue.enqueue({ id: item.id, draftId, key: item.key, file });
    },
    [draftId, queue],
  );

  useEffect(() => () => queue.cancelAll(), [queue]);

  useEffect(() => {
    const onOffline = () => {
      for (const item of stateRef.current.items) {
        if (item.status !== "queued" && item.status !== "initiating" && item.status !== "uploading") continue;
        queue.cancel(item.id);
        dispatch({ type: "paused", id: item.id });
      }
    };
    const onOnline = () => {
      for (const item of stateRef.current.items) {
        if (item.status !== "paused") continue;
        const file = files.current.get(item.id);
        if (!file) continue;
        dispatch({ type: "unpaused", id: item.id });
        // An aborted job frees its slot when it settles; wait for that instead of losing the re-queue.
        const start = () => {
          if (queue.has(item.id)) setTimeout(start, 25);
          else queue.enqueue({ id: item.id, draftId, key: item.key, file });
        };
        start();
      }
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [draftId, queue]);


  const hasActive = state.items.some(isInFlight);
  useEffect(() => {
    if (!hasActive) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasActive]);

  const addFiles = useCallback(
    (selected: readonly File[]) => {
      const dropped = selected.map((file) => {
        const id = newId();
        files.current.set(id, file);
        const rejectReason = rejectionFor(file, accept, maxBytes);
        return { id, name: file.name, size: file.size, lastModified: file.lastModified, ...(rejectReason && { rejectReason }) };
      });
      const next = uploadReducer(stateRef.current, { type: "dropped", files: dropped });
      // Compute the accepted set from the same reducer the UI uses so duplicate detection cannot diverge.
      stateRef.current = next;
      dispatch({ type: "dropped", files: dropped });
      for (const item of next.items) {
        if (dropped.some((file) => file.id === item.id)) {
          if (item.status === "queued") enqueue(item);
          else files.current.delete(item.id);
        }
      }
    },
    [accept, enqueue, maxBytes],
  );

  const retry = useCallback(
    (id: string) => {
      const item = stateRef.current.items.find((candidate) => candidate.id === id);
      if (!item || item.status !== "failed") return;
      dispatch({ type: "retry", id });
      enqueue({ ...item, status: "queued" });
    },
    [enqueue],
  );

  const retryAll = useCallback(() => {
    for (const item of stateRef.current.items) if (item.status === "failed") retry(item.id);
  }, [retry]);

  const remove = useCallback(
    (id: string) => {
      const item = stateRef.current.items.find((candidate) => candidate.id === id);
      if (!item) return;
      const cancelled = queue.cancel(id);
      files.current.delete(id);
      dispatch({ type: "remove", id });
      const storedRemotely = item.status === "done" || item.status === "remove_failed";
      // A file cancelled after init or commit may exist on the server; clean it up without blocking the UI.
      const maybeRemote = cancelled && item.status !== "queued";
      if (storedRemotely) {
        transport.remove(draftId, item.key).then(
          () => dispatch({ type: "removed", id }),
          () => dispatch({ type: "remove_failed", id }),
        );
      } else if (maybeRemote) {
        transport.remove(draftId, item.key).catch(() => undefined);
      }
    },
    [draftId, queue, transport],
  );

  const resume = useCallback(
    (id: string, file: File) => {
      const item = stateRef.current.items.find((candidate) => candidate.id === id);
      if (!item || item.status !== "interrupted") return;
      // Server-listed rows have no lastModified (0) and only know the size when the server reported it.
      const sameName = file.name === item.key;
      const sameSize = item.size === 0 || file.size === item.size;
      const sameStamp = item.lastModified === 0 || file.lastModified === item.lastModified;
      if (!sameName || !sameSize || !sameStamp || rejectionFor(file, accept, maxBytes)) {
        dispatch({ type: "resume_mismatch", id });
        return;
      }
      files.current.set(id, file);
      dispatch({ type: "resumed", id });
      queue.enqueue({ id, draftId, key: item.key, file });
    },
    [accept, draftId, maxBytes, queue],
  );

  const replace = useCallback(
    (id: string, file: File) => {
      const item = stateRef.current.items.find((candidate) => candidate.id === id);
      if (!item || item.status !== "done" || rejectionFor(file, accept, maxBytes)) return;
      files.current.delete(id);
      dispatch({ type: "remove", id });
      stateRef.current = uploadReducer(stateRef.current, { type: "remove", id });
      transport.remove(draftId, item.key).then(
        () => {
          // The name may be reused by the replacement, so the duplicate check must already see the row gone.
          stateRef.current = uploadReducer(stateRef.current, { type: "removed", id });
          dispatch({ type: "removed", id });
          addFiles([file]);
        },
        () => dispatch({ type: "remove_failed", id }),
      );
    },
    [accept, addFiles, draftId, maxBytes, transport],
  );

  const summary = useMemo(() => summarize(state), [state]);

  return { items: state.items, summary, hasActive, accept, maxBytes, addFiles, retry, retryAll, remove, resume, replace };
};

export { useUploads };
export type { UseUploads, UseUploadsOptions };
