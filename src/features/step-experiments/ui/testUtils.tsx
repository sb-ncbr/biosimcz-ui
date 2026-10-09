import type { ReactNode } from "react";
import { emptyDraft, emptyRun, type DepositionDraft, type Run } from "@/entities/deposition";
import { createMemoryMirror, DraftProvider, useDraft } from "@/features/draft";
import { renderWithProviders } from "@/test/renderWithProviders";

// Test helpers shared by the RunsOverview and RunEditor tests.
const Probe = () => {
  const { draft } = useDraft();
  return <output data-testid="runs">{JSON.stringify(draft.runs)}</output>;
};

const draftWith = (...runs: Partial<Run>[]): DepositionDraft => ({
  ...emptyDraft(),
  runs: runs.map((run, index) => ({ ...emptyRun(`r${index + 1}`), ...run })),
});

const renderInDraft = (draft: DepositionDraft, children: ReactNode) =>
  renderWithProviders(
    <DraftProvider
      userId="u1"
      mirror={createMemoryMirror()}
      initial={{
        id: "d1",
        status: "draft",
        revision: 1,
        createdAt: "2026-09-30T00:00:00Z",
        updatedAt: "2026-09-30T00:00:00Z",
        draft,
        files: [],
      }}
    >
      {children}
      <Probe />
    </DraftProvider>,
  );

const runsNow = (): Run[] => JSON.parse(document.querySelector("[data-testid=runs]")?.textContent ?? "[]") as Run[];

export { draftWith, renderInDraft, runsNow };
