"use client";

import { useEffect, useRef, useState } from "react";
import type { Run } from "@/entities/deposition";
import { useDraft } from "@/features/draft";
import { useUploads, type UseUploads, type UseUploadsOptions } from "@/features/upload";
import { UPLOAD_LIMITS } from "@/shared/config/client";

const sameSet = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((key) => b.includes(key));

// Wires the upload pipeline to one run: committed keys land in that run's fileKeys. Runs are not prefilled from their
// files yet (the run parse endpoint is not specified), so a finished upload only changes the key list.
const useRunUploads = (run: Run, options: Pick<UseUploadsOptions, "transport"> = {}): UseUploads => {
  const { draftId, files, updateDraft } = useDraft();
  const runId = run.id;
  const [initialFiles] = useState(() =>
    files
      .filter((file) => file.status === "completed" && run.fileKeys.includes(file.key))
      .map((file) => ({ key: file.key, size: file.size, status: "completed" as const })),
  );
  const uploads = useUploads(draftId, { accept: UPLOAD_LIMITS.experimentExtensions, initialFiles, ...options });
  const { items } = uploads;

  // Keys this visit saw as stored; only those may be dropped again, so keys the server list never mentioned survive.
  const seen = useRef(new Set<string>());
  useEffect(() => {
    const stored = items.filter((item) => item.status === "done" || item.status === "remove_failed").map((item) => item.key);
    for (const key of stored) seen.current.add(key);
    const gone = [...seen.current].filter(
      (key) => !stored.includes(key) && !items.some((item) => item.key === key && item.status === "removing"),
    );
    const current = run.fileKeys;
    const next = [...current.filter((key) => !gone.includes(key)), ...stored.filter((key) => !current.includes(key))];
    if (sameSet(next, current)) return;
    for (const key of gone) seen.current.delete(key);
    updateDraft((draft) => ({ ...draft, runs: draft.runs.map((candidate) => (candidate.id === runId ? { ...candidate, fileKeys: next } : candidate)) }));
  }, [items, run.fileKeys, runId, updateDraft]);

  return uploads;
};

export { useRunUploads };
