"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { draftHref, newRunId, type Run, type SimulationType } from "@/entities/deposition";
import { useDraft } from "@/features/draft";
import { bffFetch } from "@/shared/lib";
import { createRun, duplicateRun, insertAfter, moveRun } from "../lib/runs";
import { markJustCreated } from "./justCreated";

type RunActions = {
  // Appends a run of the chosen type and opens its editor.
  addRun: (type: SimulationType) => void;
  duplicate: (runId: string) => void;
  move: (runId: string, delta: -1 | 1) => void;
  remove: (run: Run) => void;
};

const useRunActions = (): RunActions => {
  const { draftId, updateDraft } = useDraft();
  const router = useRouter();

  const addRun = useCallback(
    (type: SimulationType) => {
      const id = newRunId();
      markJustCreated(id);
      updateDraft((draft) => ({ ...draft, runs: [...draft.runs, createRun(type, draft.runs, id)] }));
      router.push(draftHref(draftId, "experiments", id));
    },
    [draftId, router, updateDraft],
  );

  const duplicate = useCallback(
    (runId: string) => {
      updateDraft((draft) => {
        const source = draft.runs.find((run) => run.id === runId);
        return source ? { ...draft, runs: insertAfter(draft.runs, runId, duplicateRun(source, draft.runs)) } : draft;
      });
      toast.success("Run duplicated");
    },
    [updateDraft],
  );

  const move = useCallback(
    (runId: string, delta: -1 | 1) => updateDraft((draft) => ({ ...draft, runs: moveRun(draft.runs, runId, delta) })),
    [updateDraft],
  );

  const remove = useCallback(
    (run: Run) => {
      updateDraft((draft) => ({ ...draft, runs: draft.runs.filter((candidate) => candidate.id !== run.id) }));
      // Best effort: a file the server could not delete stays orphaned on the draft, never blocks the user.
      for (const key of run.fileKeys) {
        void bffFetch(`/bff/depositions/${encodeURIComponent(draftId)}/files/${encodeURIComponent(key)}`, { method: "DELETE" });
      }
      toast.success("Run deleted");
    },
    [draftId, updateDraft],
  );

  return useMemo(() => ({ addRun, duplicate, move, remove }), [addRun, duplicate, move, remove]);
};

export { useRunActions };
export type { RunActions };
