import type { z } from "zod";
import { computeCompleteness, type FieldRef } from "./completeness";
import { draftSchema } from "./schema.draft";
import type { DepositionDraft } from "./types";

// Strict schema for Publish: the lenient draft schema plus every rule of the section registry (required fields,
// conditional rules such as embargo date, box angles and NpT temperature/pressure, at least one run, files per run).
// It is built on computeCompleteness so the button, the review list and the server can never disagree.

const issuePath = (ref: FieldRef, draft: DepositionDraft): (string | number)[] => {
  const segments = ref.path.split(".");
  if (ref.stepId === "study" || ref.stepId === "system") return [ref.stepId, ...segments];
  const index = draft.runs.findIndex((run) => run.id === ref.runId);
  return index < 0 ? ["runs"] : ["runs", index, ...segments];
};

const publishSchema = draftSchema.superRefine((draft, ctx) => {
  const { missing, fixes } = computeCompleteness(draft);
  for (const ref of missing) ctx.addIssue({ code: "custom", message: "required", path: issuePath(ref, draft) });
  for (const ref of fixes) ctx.addIssue({ code: "custom", message: ref.code ?? "invalid", path: issuePath(ref, draft) });
});

// Field path -> message key, in the shape the BFF sends to the browser.
const toFieldErrors = (issues: readonly z.core.$ZodIssue[]): Record<string, string> =>
  Object.fromEntries(issues.map((issue) => [issue.path.join("."), `errors.field.${/^[a-z_]+$/.test(issue.message) ? issue.message : "invalid"}`]));

export { publishSchema, toFieldErrors };
