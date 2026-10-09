"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { draftHref, isDraftId } from "@/entities/deposition";
import { err, type Result } from "@/shared/lib";
import { isApiError, toDTO, type ApiErrorDTO } from "@/server/http/errors";
import { loginHref } from "@/entities/session";
import { logger } from "@/server/lib/logger";
import { createDraft as createDraftRecord } from "@/server/repositories/deposition";
import { nextCookieJar } from "@/server/session";

const LIST_PATH = "/depositions";

// "New" and "New Deposition": creates an empty draft (U2, no metadata) and continues in the wizard's first step.
// Never returns on success (redirects). Failures come back as data because thrown errors lose their message in
// production. Session check: the repository call needs the sealed session and answers "auth" without one. Origin
// check: Next verifies Origin against Host for every server action.
const createDraft = async (): Promise<Result<null, ApiErrorDTO>> => {
  let draftId: string;
  try {
    draftId = (await createDraftRecord(await nextCookieJar())).id;
  } catch (error) {
    if (isApiError(error) && error.kind === "auth") redirect(loginHref(LIST_PATH, { expired: true }));
    logger.warn("create draft failed", { kind: isApiError(error) ? error.kind : "unexpected", code: isApiError(error) ? error.code : undefined });
    return err(toDTO(error));
  }

  // The id reaches a redirect target; anything the backend sends that is not id-shaped is treated as a failed create.
  if (!isDraftId(draftId)) {
    logger.error("create draft returned an unusable id");
    return err({ kind: "schema", code: "bad_draft_id", messageKey: "errors.schema" });
  }

  revalidatePath(LIST_PATH);
  redirect(draftHref(draftId, "study"));
};

export { createDraft };
