"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { UseUploads } from "./useUploads";

type UploadsStatus = { active: boolean; failed: number };

type UploadsRegistry = {
  report: (id: string, status: UploadsStatus) => void;
  forget: (id: string) => void;
};

type DraftUploads = {
  // Any upload anywhere in the draft is not yet safely stored: drives the Publish rule.
  hasActive: boolean;
  // Failed plus interrupted files across the draft.
  failed: number;
};

const RegistryContext = createContext<UploadsRegistry | null>(null);
const TotalsContext = createContext<DraftUploads>({ hasActive: false, failed: 0 });

// Draft-wide view of every upload queue (system files, each run's files). Each queue reports two primitives, so
// reporting never loops; the queues themselves stay where they are mounted.
const UploadsRegistryProvider = ({ children }: { children: ReactNode }) => {
  const [entries, setEntries] = useState<Record<string, UploadsStatus>>({});
  const report = useCallback((id: string, status: UploadsStatus) => {
    setEntries((current) => {
      const before = current[id];
      return before?.active === status.active && before.failed === status.failed ? current : { ...current, [id]: status };
    });
  }, []);
  const forget = useCallback((id: string) => {
    setEntries((current) => {
      if (!(id in current)) return current;
      const rest = { ...current };
      delete rest[id];
      return rest;
    });
  }, []);
  const registry = useMemo(() => ({ report, forget }), [report, forget]);
  const totals = useMemo<DraftUploads>(() => {
    const all = Object.values(entries);
    return { hasActive: all.some((entry) => entry.active), failed: all.reduce((sum, entry) => sum + entry.failed, 0) };
  }, [entries]);
  return (
    <RegistryContext.Provider value={registry}>
      <TotalsContext.Provider value={totals}>{children}</TotalsContext.Provider>
    </RegistryContext.Provider>
  );
};

const useDraftUploads = (): DraftUploads => useContext(TotalsContext);

// Without a provider (isolated component tests) registering is a no-op.
const useRegisterUploads = (id: string, uploads: UseUploads): void => {
  const registry = useContext(RegistryContext);
  const { hasActive, summary } = uploads;
  const failed = summary.failed + summary.interrupted;
  useEffect(() => {
    registry?.report(id, { active: hasActive, failed });
  }, [registry, id, hasActive, failed]);
  useEffect(() => () => registry?.forget(id), [registry, id]);
};

export { UploadsRegistryProvider, useDraftUploads, useRegisterUploads };
export type { DraftUploads };
