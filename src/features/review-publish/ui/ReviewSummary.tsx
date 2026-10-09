"use client";

import { useMemo } from "react";
import { useDraft } from "@/features/draft";
import { useSystemUploadsContext } from "@/features/step-system";
import { useDraftUploads } from "@/features/upload";
import { buildRows, missingLookup } from "../model/problems";
import { ExperimentsSummary } from "./ExperimentsSummary";
import { MissingFields } from "./MissingFields";
import { usePublishFlow } from "./PublishFlow";
import { StudySummary } from "./StudySummary";
import { SystemSummary } from "./SystemSummary";

// Body of the Review page (226:5484): the missing-fields box, then one summary per step. Everything is read from the live
// draft, so edits made in another step show up at once.
const ReviewSummary = () => {
  const { draftId, draft, completeness } = useDraft();
  const { uploads } = useSystemUploadsContext();
  const draftUploads = useDraftUploads();
  const { serverProblems } = usePublishFlow();

  const rows = useMemo(
    () => buildRows(draftId, serverProblems ?? [...completeness.missing, ...completeness.fixes], uploads.items),
    [draftId, serverProblems, completeness.missing, completeness.fixes, uploads.items],
  );
  const find = useMemo(() => missingLookup(completeness.missing), [completeness.missing]);
  const step = (id: "study" | "system" | "experiments") => completeness.steps.find((item) => item.id === id);
  const study = step("study");
  const system = step("system");
  const experiments = step("experiments");

  return (
    <>
      <MissingFields
        draftId={draftId}
        rows={rows}
        requiredLeft={completeness.requiredLeft}
        toFix={completeness.toFix}
        fromServer={serverProblems !== null}
        uploading={draftUploads.hasActive}
      />
      {study ? <StudySummary draftId={draftId} study={draft.study} result={study} find={find} /> : null}
      {system ? <SystemSummary draftId={draftId} system={draft.system} result={system} find={find} /> : null}
      {experiments ? <ExperimentsSummary draftId={draftId} draft={draft} result={experiments} find={find} /> : null}
    </>
  );
};

export { ReviewSummary };
