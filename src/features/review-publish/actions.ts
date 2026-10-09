"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { computeCompleteness, isDraftId, publishSchema, toFieldErrors } from "@/entities/deposition";
import { err, ok, type Result } from "@/shared/lib";
import { ApiError, isApiError, toDTO } from "@/server/http/errors";
import { logger } from "@/server/lib/logger";
import { getDraft, publishDraft as publishDraftRecord } from "@/server/repositories/deposition";
import { assertSameOriginHeaders, nextCookieJar, requireSession } from "@/server/session";
import type { PublishFailure, PublishOutcome } from "./model/types";

const LIST_PATH = "/depositions";

// The backend value ends up in an href: only https URLs and same-origin paths pass (no javascript:, data:, //host).
const safeRecordUrl = (value: string | null): string | null => {
  if (!value) return null;
  if (value.startsWith("/")) return value.startsWith("//") || value.includes("\\") ? null : value;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
};

const fail = (error: unknown): Result<never, PublishFailure> => {
  logger.warn("publish failed", { kind: isApiError(error) ? error.kind : "unexpected", code: isApiError(error) ? error.code : undefined });
  return err(toDTO(error));
};

// Publish button, after the confirm dialog. Never trusts the browser: the draft is read again from the backend and
// validated with the publish schema, so the button state, the review list and this check share one rule (plan D6).
// Checks, in order: origin (CSRF; Next adds its own Origin/Host check for actions), session, id shape, draft state,
// schema. Failures come back as data because thrown errors lose their message in production.
const publishDraft = async (draftId: string): Promise<Result<PublishOutcome, PublishFailure>> => {
  try {
    assertSameOriginHeaders("POST", await headers());
    const jar = await nextCookieJar();
    await requireSession(jar);
    if (!isDraftId(draftId)) throw new ApiError({ kind: "not_found", backend: "mdrepo", code: "draft_not_found" });

    const snapshot = await getDraft(jar, draftId);
    if (snapshot.status !== "draft") throw new ApiError({ kind: "conflict", backend: "mdrepo", status: 409, code: "not_editable" });

    const parsed = publishSchema.safeParse(snapshot.draft);
    if (!parsed.success) {
      const { missing, fixes } = computeCompleteness(snapshot.draft);
      return err({
        ...toDTO(new ApiError({ kind: "validation", backend: "mdrepo", fieldErrors: toFieldErrors(parsed.error.issues) })),
        problems: [...missing, ...fixes],
      });
    }

    // TODO(backend): E-D3 is PROPOSED; map its per-field errors (metadata.study.title, ...) to Review rows once confirmed.
    const record = await publishDraftRecord(jar, draftId, snapshot.revision);
    revalidatePath(LIST_PATH);
    return ok({ status: record.status, doi: record.doi, recordUrl: safeRecordUrl(record.recordUrl) });
  } catch (error) {
    return fail(error);
  }
};

export { publishDraft };
