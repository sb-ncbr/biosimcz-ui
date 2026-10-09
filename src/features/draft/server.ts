import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { draftHref, isDraftId, type DraftSnapshot } from "@/entities/deposition";
import { loginHref } from "@/entities/session";
import { isApiError } from "@/server/http/errors";
import { getDraft } from "@/server/repositories/deposition";
import { nextCookieJar } from "@/server/session";

// Reads the draft for a wizard render (E-D1). Memoised per request, so the layout and the page share one backend call.
// Validation comes first: the id reaches hrefs, the `next` parameter and backend paths, so anything malformed is a 404.
const loadDraft = cache(async (draftId: string): Promise<DraftSnapshot> => {
  if (!isDraftId(draftId)) notFound();

  let snapshot: DraftSnapshot | undefined;
  try {
    snapshot = await getDraft(await nextCookieJar(false), draftId);
  } catch (error) {
    if (isApiError(error)) {
      // Drafts of other users answer 404 as well; showing "no access" would reveal that the draft exists (Q1 default).
      if (error.kind === "not_found" || error.kind === "forbidden") notFound();
      if (error.kind === "auth") redirect(loginHref(draftHref(draftId), { expired: true }));
    }
    throw error;
  }

  // TODO(Q7): send published depositions to their record page once that route exists.
  if (snapshot.status !== "draft") redirect("/depositions");
  return snapshot;
});

export { loadDraft };
