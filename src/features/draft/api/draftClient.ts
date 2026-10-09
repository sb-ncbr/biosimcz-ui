import type { DepositionDraft, DraftSnapshot } from "@/entities/deposition";
import { bffFetch, type BffError, type Result } from "@/shared/lib";

type SaveOutcome =
  | { kind: "saved"; revision: number; updatedAt: string }
  | { kind: "conflict" }
  | { kind: "session-expired" }
  | { kind: "failed"; code: string };

type SaveOptions = { keepalive?: boolean };

const draftUrl = (draftId: string): string => `/bff/depositions/${encodeURIComponent(draftId)}`;

const toOutcome = (error: BffError): SaveOutcome => {
  if (error.kind === "auth") return { kind: "session-expired" };
  if (error.kind === "conflict") return { kind: "conflict" };
  return { kind: "failed", code: error.code ?? error.kind };
};

// PUT /bff/depositions/[draftId]. keepalive lets the request outlive the page on pagehide (the draft is far below the
// 64 KB keepalive body limit).
const saveDraftRequest = async (draftId: string, draft: DepositionDraft, revision: number, options: SaveOptions = {}): Promise<SaveOutcome> => {
  const result = await bffFetch<{ revision: number; updatedAt: string }>(draftUrl(draftId), {
    method: "PUT",
    body: JSON.stringify({ draft, revision }),
    keepalive: options.keepalive === true,
  });
  return result.ok ? { kind: "saved", revision: result.value.revision, updatedAt: result.value.updatedAt } : toOutcome(result.error);
};

// GET /bff/depositions/[draftId]: the current server copy, for conflict recovery.
const loadDraftRequest = (draftId: string): Promise<Result<DraftSnapshot, BffError>> => bffFetch<DraftSnapshot>(draftUrl(draftId));

export { loadDraftRequest, saveDraftRequest };
export type { SaveOptions, SaveOutcome };
