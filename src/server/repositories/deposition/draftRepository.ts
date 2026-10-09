import "server-only";
import type { DepositionDraft, DraftSnapshot } from "@/entities/deposition";
import { publishDraft as publishDraftRequest, readDraft, saveDraft as saveDraftRequest } from "../../backends/mdrepo/client";
import type { CookieJar } from "../../session";
import { withUpstream } from "../../session";
import { fromExperimentMetadata, toExperimentMetadata } from "./mapper";

type SavedDraft = { revision: number; updatedAt: string };

// E-D1. RSC callers pass a read-only jar (no refresh); route handlers pass a writable one.
const getDraft = async (jar: CookieJar, draftId: string): Promise<DraftSnapshot> => {
  const { data } = await withUpstream(jar, (auth) => readDraft(draftId, auth));
  return {
    id: data.id,
    // "in_review" and "published" are both read-only for the wizard.
    status: data.status === "draft" ? "draft" : "published",
    ...(data.doi ? { doi: data.doi } : {}),
    revision: data.revision,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    draft: fromExperimentMetadata(data.metadata),
    files: data.files.map((file) => ({
      key: file.key,
      size: file.size ?? 0,
      status: file.status,
      ...(file.mimetype !== undefined && { mimetype: file.mimetype }),
    })),
  };
};

// E-D2. The caller has already validated `draft` with the lenient schema.
const saveDraft = async (jar: CookieJar, draftId: string, draft: DepositionDraft, revision: number): Promise<SavedDraft> => {
  const { data } = await withUpstream(jar, (auth) => saveDraftRequest(draftId, toExperimentMetadata(draft), revision, auth));
  return { revision: data.revision, updatedAt: data.updated_at };
};

type PublishedRecord = { status: "published" | "in_review"; doi: string | null; recordUrl: string | null };

// E-D3. The caller has re-validated the draft with the publish schema; `revision` is the one it validated.
const publishDraft = async (jar: CookieJar, draftId: string, revision: number): Promise<PublishedRecord> => {
  const { data } = await withUpstream(jar, (auth) => publishDraftRequest(draftId, revision, auth));
  return { status: data.status, doi: data.doi ?? null, recordUrl: data.record_url ?? null };
};

export { getDraft, publishDraft, saveDraft };
export type { PublishedRecord, SavedDraft };
