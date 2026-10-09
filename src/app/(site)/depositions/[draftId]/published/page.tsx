import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { draftHref, isDraftId } from "@/entities/deposition";
import { loginHref } from "@/entities/session";
import { PublishedView } from "@/features/review-publish";
import { isApiError } from "@/server/http/errors";
import { getDraft } from "@/server/repositories/deposition";
import { nextCookieJar, requireSessionOrRedirect } from "@/server/session";

const metadata: Metadata = { title: "Deposition published | MDRepo" };

// Success page after Publish (missing-states 6.5). It reads the stored state, so opening the URL later works too; a draft
// that is not published yet goes back to the wizard.
const PublishedPage = async ({ params }: { params: Promise<{ draftId: string }> }) => {
  const { draftId } = await params;
  if (!isDraftId(draftId)) notFound();
  const here = `/depositions/${encodeURIComponent(draftId)}/published`;
  await requireSessionOrRedirect(here);

  let snapshot;
  try {
    snapshot = await getDraft(await nextCookieJar(false), draftId);
  } catch (error) {
    if (isApiError(error) && error.kind === "auth") redirect(loginHref(here, { expired: true }));
    // Unknown and foreign drafts look the same (missing-states Q1 default).
    if (isApiError(error) && (error.kind === "not_found" || error.kind === "forbidden")) notFound();
    throw error;
  }
  if (snapshot.status === "draft") redirect(draftHref(draftId));

  return <PublishedView study={snapshot.draft.study} doi={snapshot.doi ?? null} />;
};

export { metadata };
export default PublishedPage;
