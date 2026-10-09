import { draftHref, type Completeness, type DepositionDraft, type StepResult } from "@/entities/deposition";
import type { PublishModel, SaveState, WizardNavEntry, WizardNavModel, WizardStep } from "@/widgets/wizard-shell";

const plural = (count: number, one: string): string => `${count} ${one}${count === 1 ? "" : "s"}`;

type NavInput = {
  draftId: string;
  draft: DepositionDraft;
  completeness: Completeness;
  save: SaveState;
};

const entryOf = (step: StepResult, draftId: string): WizardNavEntry => ({
  id: step.id,
  label: step.title,
  href: draftHref(draftId, step.id),
  status: step.status,
  requiredLeft: step.requiredLeft,
  optionalLeft: step.optionalLeft,
  toFix: step.toFix,
});

// Sidebar model straight from computeCompleteness, so the counts are never static (final-approved C17).
const buildWizardNav = ({ draftId, draft, completeness, save }: NavInput): WizardNavModel => ({
  backHref: "/depositions",
  draft: { title: draft.study.title?.trim() || null, save },
  steps: completeness.steps.map((step): WizardStep => {
    const entry = entryOf(step, draftId);
    if (step.id !== "experiments") return entry;
    return {
      ...entry,
      runs: step.runs.map(
        (run): WizardNavEntry => ({
          id: run.id,
          label: run.name ?? "Unnamed run",
          href: draftHref(draftId, "experiments", run.id),
          status: run.status,
          requiredLeft: run.requiredLeft,
          optionalLeft: run.optionalLeft,
          toFix: run.toFix,
        }),
      ),
    };
  }),
  review: { href: draftHref(draftId, "review"), ready: completeness.ready },
});

// Publish is never natively disabled; the reason explains why (missing-states 2.4). This is the enable rule: ready,
// nothing uploading, nothing failed, online. The confirm dialog and the action live in features/review-publish.
type PublishInput = Pick<NavInput, "draftId" | "completeness" | "save"> & {
  // Any file not yet safely stored (queued, uploading, committing, parsing, paused) blocks Publish (plan 4.7).
  uploadsInFlight?: boolean;
  // Files that failed or were interrupted (they never reached the server).
  uploadsFailed?: number;
};

const buildPublishModel = ({ draftId, completeness, save, uploadsInFlight = false, uploadsFailed = 0 }: PublishInput): PublishModel => {
  const blockedHref = draftHref(draftId, "review");
  // Offline: nothing to show on Review either, so a click only explains itself (toast from the shell).
  if (save.kind === "offline") return { state: "blocked", reason: "You are offline" };
  if (uploadsInFlight) return { state: "blocked", reason: "Wait for file uploads to finish", blockedHref };
  if (uploadsFailed > 0) return { state: "blocked", reason: `${plural(uploadsFailed, "file")} did not upload`, blockedHref };
  if (completeness.toFix > 0) return { state: "blocked", reason: `Fix ${plural(completeness.toFix, "field")} to publish`, blockedHref };
  if (completeness.requiredLeft > 0) {
    return { state: "blocked", reason: `Fill in ${plural(completeness.requiredLeft, "required field")} to publish`, blockedHref };
  }
  return { state: "ready" };
};

export { buildPublishModel, buildWizardNav };
