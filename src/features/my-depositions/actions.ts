"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isDraftId } from "@/entities/deposition";
import { err, ok, type Result } from "@/shared/lib";
import { isApiError, toDTO, type ApiErrorDTO } from "@/server/http/errors";
import { loginHref } from "@/entities/session";
import { logger } from "@/server/lib/logger";
import { deleteDraft as deleteDraftRecord } from "@/server/repositories/deposition";
import { nextCookieJar } from "@/server/session";

const LIST_PATH = "/depositions";

// Card menu "Delete draft". Session check: the repository call needs the sealed session and answers "auth" without
// one. Origin check: Next verifies Origin against Host for every server action. The id is shape-checked because it
// becomes a backend path segment.
const deleteDraft = async (draftId: string): Promise<Result<null, ApiErrorDTO>> => {
  if (!isDraftId(draftId)) return err({ kind: "not_found", status: 404, messageKey: "errors.not_found" });
  try {
    await deleteDraftRecord(await nextCookieJar(), draftId);
  } catch (error) {
    if (isApiError(error) && error.kind === "auth") redirect(loginHref(LIST_PATH, { expired: true }));
    // Already gone (another tab, another device): the outcome the user wanted, so it is not an error.
    if (!(isApiError(error) && error.kind === "not_found")) {
      logger.warn("delete draft failed", { kind: isApiError(error) ? error.kind : "unexpected", code: isApiError(error) ? error.code : undefined });
      return err(toDTO(error));
    }
  }
  revalidatePath(LIST_PATH);
  return ok(null);
};

export { deleteDraft };
