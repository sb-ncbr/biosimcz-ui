"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Run } from "@/entities/deposition";
import { useDraft } from "@/features/draft";
import { useRegisterUploads, type UseUploads } from "@/features/upload";
import { useRunUploads } from "../model/useRunUploads";

type Options = Parameters<typeof useRunUploads>[1];
type RunUploads = { get: (runId: string) => UseUploads | undefined };

const RunUploadsContext = createContext<RunUploads | null>(null);

// Null outside the provider: the run editor then owns its queue (isolated tests).
const useRunUploadsRegistry = (): RunUploads | null => useContext(RunUploadsContext);

type HostProps = { run: Run; options: Options; publish: (runId: string, uploads: UseUploads) => void; notify: () => void };

// One queue per run, mounted for as long as the run exists, so leaving the run screen no longer aborts its uploads.
const RunUploadsHost = ({ run, options, publish, notify }: HostProps) => {
  const uploads = useRunUploads(run, options);
  useRegisterUploads(`run:${run.id}`, uploads);
  // The latest object is stored on every render; consumers are only woken when the items change.
  useEffect(() => {
    publish(run.id, uploads);
  });
  useEffect(() => {
    notify();
  }, [uploads.items, notify]);
  return null;
};

type RunUploadsProviderProps = {
  // Test seam for the upload transport; production uses the XHR one.
  options?: Options;
  children: ReactNode;
};

// Mounted by the wizard layout inside DraftProvider, next to SystemUploadsProvider.
const RunUploadsProvider = ({ options, children }: RunUploadsProviderProps) => {
  const { draft } = useDraft();
  const store = useRef(new Map<string, UseUploads>());
  const [version, setVersion] = useState(0);
  const publish = useCallback((runId: string, uploads: UseUploads) => {
    store.current.set(runId, uploads);
  }, []);
  const notify = useCallback(() => setVersion((current) => current + 1), []);
  const runIds = draft.runs.map((run) => run.id).join("\n");
  useEffect(() => {
    const live = new Set(runIds.split("\n"));
    for (const id of store.current.keys()) if (!live.has(id)) store.current.delete(id);
  }, [runIds]);
  // `version` changes the value identity so consumers re-read the store.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo<RunUploads>(() => ({ get: (runId) => store.current.get(runId) }), [version]);
  return (
    <RunUploadsContext.Provider value={value}>
      {draft.runs.map((run) => (
        <RunUploadsHost key={run.id} run={run} options={options} publish={publish} notify={notify} />
      ))}
      {children}
    </RunUploadsContext.Provider>
  );
};

export { RunUploadsProvider, useRunUploadsRegistry };
export type { RunUploadsProviderProps };
