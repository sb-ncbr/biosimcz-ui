import { redirect } from "next/navigation";
import { computeCompleteness, draftHref, firstIncompleteStep } from "@/entities/deposition";
import { loadDraft } from "@/features/draft/server";

// Opens the draft where work is left: the first step that is not done, else the review page. A new empty draft lands on step 1.
const DraftIndexPage = async ({ params }: { params: Promise<{ draftId: string }> }) => {
  const { draftId } = await params;
  const { draft } = await loadDraft(draftId);
  redirect(draftHref(draftId, firstIncompleteStep(computeCompleteness(draft))));
};

export default DraftIndexPage;
