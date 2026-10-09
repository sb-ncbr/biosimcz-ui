"use client";

// Step 1 "Study details". Client-only; the page under app/(wizard)/depositions/[draftId]/study renders <StudyForm />.
export { LookupsContext, mockLookups } from "./api/lookups";
export type { Community, Organisation, OrcidResult, StudyLookups } from "./api/lookups";
export { enableShowRequired } from "@/shared/lib/showRequired";
export { StudyForm } from "./ui/StudyForm";
// Display helpers reused by the review page, so its wording and labels never drift from the form.
export { useLookups } from "./api/lookups";
export { displayName, initials, isOrganisation, subtitle } from "./model/creators";
export { labelOf, LICENSES, RELATIONS, SCHEMES } from "./model/lists";
export type { Funding, RelatedWork } from "./model/lists";
