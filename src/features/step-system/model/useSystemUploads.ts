"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { DepositionDraft, DraftFileInfo } from "@/entities/deposition";
import { useDraft } from "@/features/draft";
import { useUploads, type ServerFile, type UseUploads, type UseUploadsOptions } from "@/features/upload";
import { applyChanges, planPrefill, uniqueLabels, type PrefillChange, type PrefillGroup } from "../lib/prefill";

type PrefillReport = {
  // Upload row id, so one file reports once.
  id: string;
  file: string;
  filled: PrefillGroup[];
  // Values the user already had that differ from the file; replaced only after confirmation.
  kept: PrefillChange[];
};

type ReportAction = { type: "add"; report: PrefillReport } | { type: "dismiss"; id: string } | { type: "resolved"; id: string };

const reportReducer = (state: PrefillReport[], action: ReportAction): PrefillReport[] => {
  switch (action.type) {
    case "add":
      return [...state.filter((report) => report.id !== action.report.id), action.report];
    case "dismiss":
      return state.filter((report) => report.id !== action.id);
    case "resolved":
      return state.map((report) => (report.id === action.id ? { ...report, kept: [] } : report));
  }
};

// System files of the server list: the committed ones in system.fileKeys, plus pending ones no run claims.
const systemServerFiles = (draft: DepositionDraft, files: readonly DraftFileInfo[]): ServerFile[] => {
  const own = new Set(draft.system.fileKeys);
  const runKeys = new Set(draft.runs.flatMap((run) => run.fileKeys));
  return files
    .filter((file) => (file.status === "completed" ? own.has(file.key) : !runKeys.has(file.key)))
    .map((file) => ({ key: file.key, size: file.size, status: file.status }));
};

const sameSet = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((key) => b.includes(key));

type UseSystemUploads = {
  uploads: UseUploads;
  reports: PrefillReport[];
  dismissReport: (id: string) => void;
  // Replace the values the user already had with the file's (after the confirm dialog).
  applyKept: (id: string) => void;
};

// Wires the upload pipeline to the draft: committed keys land in system.fileKeys, and parse results prefill the form.
const useSystemUploads = (options: Pick<UseUploadsOptions, "transport" | "accept"> = {}): UseSystemUploads => {
  const { draftId, draft, files, updateDraft } = useDraft();
  const [initialFiles] = useState(() => systemServerFiles(draft, files));
  const uploads = useUploads(draftId, { initialFiles, ...options });
  const { items } = uploads;
  const [reports, dispatch] = useReducer(reportReducer, []);

  // Keys this visit saw as stored; only those may be dropped again, so keys the server list never mentioned survive.
  const seen = useRef(new Set<string>());
  useEffect(() => {
    const stored = items.filter((item) => item.status === "done" || item.status === "remove_failed").map((item) => item.key);
    for (const key of stored) seen.current.add(key);
    const gone = [...seen.current].filter(
      (key) => !stored.includes(key) && !items.some((item) => item.key === key && item.status === "removing"),
    );
    const current = draft.system.fileKeys;
    const next = [...current.filter((key) => !gone.includes(key)), ...stored.filter((key) => !current.includes(key))];
    if (sameSet(next, current)) return;
    for (const key of gone) seen.current.delete(key);
    updateDraft((d) => ({ ...d, system: { ...d.system, fileKeys: next } }));
  }, [items, draft.system.fileKeys, updateDraft]);

  // Each parsed file prefills once. Files finishing together are applied in one pass so the second sees the first.
  const handled = useRef(new Set<string>());
  useEffect(() => {
    const fresh = items.filter(
      (item) => item.status === "done" && item.parse?.status === "ok" && item.parse.fields.length > 0 && !handled.current.has(item.id),
    );
    if (fresh.length === 0) return;
    let system = draft.system;
    const applies: { file: string; fill: PrefillChange[] }[] = [];
    const added: PrefillReport[] = [];
    for (const item of fresh) {
      handled.current.add(item.id);
      const plan = planPrefill(system, item.name, item.parse?.fields ?? []);
      if (plan.fill.length === 0 && plan.keep.length === 0) continue;
      system = applyChanges(system, item.name, plan.fill);
      applies.push({ file: item.name, fill: plan.fill });
      added.push({
        id: item.id,
        file: item.name,
        filled: uniqueLabels(plan.fill),
        kept: plan.keep,
      });
    }
    if (added.length === 0) return;
    // Applied on the latest values, not on this render's copy: edits and other prefills may have landed since.
    updateDraft((d) => ({
      ...d,
      system: applies.reduce((current, apply) => applyChanges(current, apply.file, apply.fill), d.system),
    }));
    for (const report of added) dispatch({ type: "add", report });
  }, [items, draft.system, updateDraft]);

  const reportsRef = useRef(reports);
  useEffect(() => {
    reportsRef.current = reports;
  }, [reports]);

  const dismissReport = useCallback((id: string) => dispatch({ type: "dismiss", id }), []);
  const applyKept = useCallback(
    (id: string) => {
      const report = reportsRef.current.find((candidate) => candidate.id === id);
      if (!report) return;
      updateDraft((d) => ({
        ...d,
        system: applyChanges(d.system, report.file, report.kept),
      }));
      dispatch({ type: "resolved", id });
    },
    [updateDraft],
  );

  return useMemo(() => ({ uploads, reports, dismissReport, applyKept }), [uploads, reports, dismissReport, applyKept]);
};

export { systemServerFiles, useSystemUploads };
export type { PrefillReport, UseSystemUploads };
