import { draftHref, type FieldRef } from "@/entities/deposition";
import type { UploadItem } from "@/features/upload";

// One row of the missing-fields box (missing-states 3.4).
type ProblemRow = {
  key: string;
  label: string;
  location: string;
  href: string;
  // "Go to field" for missing values, "Fix" for format errors, "Go to file" for uploads.
  action: string;
  kind: "missing" | "format" | "file";
};

// The wizard URL of a field with its anchor as fragment; the step reads the fragment, opens the section and focuses it.
const refHref = (draftId: string, ref: FieldRef): string => {
  const base = draftHref(draftId, ref.stepId, ref.runId);
  return ref.anchor === "runs" ? base : `${base}#${ref.anchor}`;
};

const rowOf = (draftId: string, ref: FieldRef): ProblemRow => ({
  key: `${ref.kind}:${ref.runId ?? ref.stepId}:${ref.anchor}`,
  label: ref.label,
  location: ref.location,
  href: refHref(draftId, ref),
  action: ref.kind === "format" ? "Fix" : "Go to field",
  kind: ref.kind,
});

// System-step uploads that did not make it (run uploads live in their own editor and are checked by the publish rule
// through the saved file keys).
const fileRows = (draftId: string, items: readonly UploadItem[]): ProblemRow[] =>
  items
    .filter((item) => item.status === "failed" || item.status === "interrupted")
    .map((item) => ({
      key: `file:${item.id}`,
      label: `${item.name} ${item.status === "failed" ? "did not upload" : "was interrupted"}`,
      location: "Molecular system - System files",
      href: `${draftHref(draftId, "system")}#field-systemFiles-fileKeys`,
      action: "Go to file",
      kind: "file",
    }));

const buildRows = (draftId: string, refs: readonly FieldRef[], items: readonly UploadItem[] = []): ProblemRow[] => [
  ...fileRows(draftId, items),
  ...refs.map((ref) => rowOf(draftId, ref)),
];


type MissingLookup = (stepId: FieldRef["stepId"], path: string, runId?: string) => FieldRef | undefined;

// Finds the "required and empty" entry of a field, so a summary can show "Missing" instead of a value.
const missingLookup = (missing: readonly FieldRef[]): MissingLookup => {
  const index = new Map(missing.map((ref) => [`${ref.stepId}|${ref.runId ?? ""}|${ref.path}`, ref]));
  return (stepId, path, runId) => index.get(`${stepId}|${runId ?? ""}|${path}`);
};

export { buildRows, missingLookup, refHref };
export type { MissingLookup, ProblemRow };
