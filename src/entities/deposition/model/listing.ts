import type { AccessValue } from "./enums";
import type { CompletionStatus } from "./completeness";
import type { StepId } from "./sections";

// Domain shapes of the "My depositions" list (E-L1, PROPOSED). Pure types and constants, shared by the repository
// mapper (server), the URL state and the list UI.

const LIST_STATUSES = ["all", "draft", "published"] as const;
const LIST_SORTS = ["updated_desc", "updated_asc", "created_desc", "title_asc"] as const;
const FACET_NAMES = ["access", "community", "structure", "engine", "author", "funder", "keyword"] as const;
const DATE_GRANULARITIES = ["year", "month"] as const;
const LIST_PAGE_SIZE = 20;

type ListStatus = (typeof LIST_STATUSES)[number];
type ListSort = (typeof LIST_SORTS)[number];
type FacetName = (typeof FACET_NAMES)[number];
type DateGranularity = (typeof DATE_GRANULARITIES)[number];

// Everything the page is a function of; round-trips through the URL.
type DepositionListQuery = {
  status: ListStatus;
  q: string;
  sort: ListSort;
  page: number;
  // Display only: how the date histogram groups the backend's buckets.
  by: DateGranularity;
  // ISO dates (YYYY-MM-DD), inclusive.
  createdFrom: string | null;
  createdTo: string | null;
  facets: Record<FacetName, readonly string[]>;
};

type FacetOption = { key: string; label: string; count: number };
type DateBucket = { key: string; count: number };

type DepositionFacets = {
  created: DateBucket[];
  options: Record<FacetName, FacetOption[]>;
};

type ProgressStep = { id: StepId; title: string; status: CompletionStatus };

// Drafts only: computed from the draft metadata with computeCompleteness, so the card and the wizard agree.
type DraftProgress = {
  steps: ProgressStep[];
  requiredLeft: number;
  // 0-100.
  completion: number;
  // The step the user should continue with (bold in the card); null when everything is done.
  attentionStep: StepId | null;
};

type DepositionListItem = {
  id: string;
  kind: "draft" | "published";
  title: string | null;
  authors: string[];
  structure: { source: string | null; id: string | null } | null;
  access: AccessValue | null;
  embargoUntil: string | null;
  license: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  doi: string | null;
  // TODO(backend): E-L1 does not list a version yet; the pill only shows when the response carries one.
  version: number | null;
  hasPreview: boolean;
  progress: DraftProgress | null;
};

type DepositionList = {
  total: number;
  page: number;
  size: number;
  counts: Record<ListStatus, number>;
  items: DepositionListItem[];
  facets: DepositionFacets;
};

export { DATE_GRANULARITIES, FACET_NAMES, LIST_PAGE_SIZE, LIST_SORTS, LIST_STATUSES };
export type {
  DateBucket,
  DateGranularity,
  DepositionFacets,
  DepositionList,
  DepositionListItem,
  DepositionListQuery,
  DraftProgress,
  FacetName,
  FacetOption,
  ListSort,
  ListStatus,
  ProgressStep,
};
