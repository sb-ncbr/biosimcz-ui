import type { StepStatus } from "@/entities/deposition/ui";

// One row of the step list. Counts come from computeCompleteness (Phase 3/4); the shell only renders them.
type WizardNavEntry = {
  id: string;
  label: string;
  href: string;
  status: StepStatus;
  requiredLeft: number;
  optionalLeft: number;
  // Format errors; replace the required pill with "N to fix" (missing-states 2.1).
  toFix?: number;
};

// Experiments is the only step with children: its runs, listed under it.
type WizardStep = WizardNavEntry & { runs?: WizardNavEntry[] };

type SaveState =
  | { kind: "saved"; label: string }
  | { kind: "saving" }
  | { kind: "retrying" }
  | { kind: "failed" }
  | { kind: "offline" }
  | { kind: "session-expired" }
  | { kind: "conflict" };

type WizardReview = { href: string; ready: boolean };

type WizardDraftSummary = {
  // null or empty renders the "Unnamed deposition" fallback.
  title: string | null;
  save: SaveState;
};

type WizardNavModel = {
  draft: WizardDraftSummary;
  steps: WizardStep[];
  review: WizardReview;
  backHref: string;
};

type PublishState = "blocked" | "ready" | "publishing";

type PublishModel = {
  state: PublishState;
  // Why Publish is blocked; also exposed through aria-describedby.
  reason?: string;
  // Where a click on a blocked Publish goes (the review page); ignored when already there.
  blockedHref?: string;
};

export type { PublishModel, PublishState, SaveState, WizardDraftSummary, WizardNavEntry, WizardNavModel, WizardReview, WizardStep };
