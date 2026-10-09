import type { FieldRef } from "@/entities/deposition";
import type { ApiErrorDTO } from "@/server/http/errors";

// What the browser learns from a successful publish. "in_review" exists because the backend may route a deposition to
// community curators (missing-states Q8); the UI treats both as "done".
type PublishOutcome = {
  status: "published" | "in_review";
  doi: string | null;
  // TODO(backend): record route (Q7, backend doc item 10); until then the success page has no "View record" link.
  recordUrl: string | null;
};

// Error DTO (message keys only) plus, for a failed re-validation, the rows the Review page lists.
type PublishFailure = ApiErrorDTO & { problems?: FieldRef[] };

export type { PublishFailure, PublishOutcome };
