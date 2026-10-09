"use client";

import Link from "next/link";
import { draftHref } from "@/entities/deposition";
import { useDraft } from "@/features/draft";
import { RunEditor } from "@/features/step-experiments";
import { Button, H1, Muted } from "@/shared/ui";
import { WizardColumn, WizardPageHeader } from "@/widgets/wizard-shell";

// Reads the run from the live draft, not from the server: a run just added is not saved yet when its page opens.
const RunScreen = ({ runId }: { runId: string }) => {
  const { draftId, draft } = useDraft();
  const index = draft.runs.findIndex((run) => run.id === runId);
  const run = draft.runs[index];

  // A missing run keeps the wizard around it (missing-states 1.3), unlike a missing draft.
  if (!run) {
    return (
      <WizardColumn>
        <H1>Run not found</H1>
        <Muted className="mt-2">This run was removed or never existed.</Muted>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href={draftHref(draftId, "experiments")}>Back to Experiments</Link>
        </Button>
      </WizardColumn>
    );
  }

  return (
    <WizardColumn className="gap-4">
      <WizardPageHeader
        eyebrow="Step 3 of 3"
        title={run.name?.trim() || "Unnamed run"}
        titleMeta={`${index + 1} of ${draft.runs.length}`}
        lead="How this run was set up."
        before={
          <Link
            href={draftHref(draftId, "experiments")}
            className="text-text-muted mb-1 block text-[11px] underline-offset-2 hover:underline"
          >
            Experiments /
          </Link>
        }
      />
      <RunEditor runId={runId} />
    </WizardColumn>
  );
};

export { RunScreen };
