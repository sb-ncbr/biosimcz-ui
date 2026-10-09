import type { Study } from "@/entities/deposition";

type Funding = Study["funding"][number];
type RelatedWork = Study["relatedWorks"][number];

// Values are proposals until the backend confirms its vocabulary; the frames only show the first two relations.
const RELATIONS = [
  { value: "supplement_to", label: "a supplement to" },
  { value: "derived_from", label: "derived from" },
  { value: "part_of", label: "part of" },
  { value: "cited_by", label: "cited by" },
  { value: "version_of", label: "a new version of" },
] as const;

const SCHEMES = [
  { value: "publication", label: "Publication" },
  { value: "structure", label: "Structure" },
  { value: "dataset", label: "Dataset" },
  { value: "other", label: "Other" },
] as const;

const LICENSES = [
  { value: "cc-by-4.0", label: "CC BY 4.0" },
  { value: "cc-by-sa-4.0", label: "CC BY-SA 4.0" },
  { value: "cc-by-nc-4.0", label: "CC BY-NC 4.0" },
  { value: "cc0-1.0", label: "CC0 1.0" },
] as const;

const labelOf = (items: readonly { value: string; label: string }[], value: string | undefined): string =>
  items.find((item) => item.value === value)?.label ?? value ?? "";

export { labelOf, LICENSES, RELATIONS, SCHEMES };
export type { Funding, RelatedWork };
