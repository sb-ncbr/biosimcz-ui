import type { AccessValue } from "@/entities/deposition";

// Domain shapes of the public record search and detail. Pure types and constants, shared by the repository adapters
// (server), the URL state and the record UI. Which facets and sorts exist depends on the data source: see capabilities.ts.

const RECORD_SORTS = ["bestmatch", "newest", "oldest", "title"] as const;
// Every facet name of every source; a source declares the subset it can apply.
const RECORD_FACETS = [
  "access",
  "community",
  "keyword",
  "software",
  "force_field",
  "solvent",
  "method",
  "type",
  "collection",
  "ensemble",
  "temp",
  "timestep",
  "creator",
  "affiliation",
  "min_atoms",
] as const;
const RECORD_PAGE_SIZE = 20;

type RecordSort = (typeof RECORD_SORTS)[number];
type RecordFacetName = (typeof RECORD_FACETS)[number];

// Everything the results page is a function of; round-trips through the URL.
type RecordSearchQuery = {
  q: string;
  sort: RecordSort;
  page: number;
  size: number;
  facets: Partial<Record<RecordFacetName, readonly string[]>>;
};

// count null = the source cannot count (hidden in the UI, never shown as 0).
type RecordFacetOption = { key: string; label: string; count: number | null };

type RecordCommunity = { id: string; label: string };

type RecordSummary = {
  id: string;
  title: string | null;
  // Display names, "Novakova J." style.
  authors: string[];
  description: string | null;
  publishedAt: string | null;
  doi: string | null;
  version: number | null;
  access: AccessValue | null;
  embargoUntil: string | null;
  license: string | null;
  communities: RecordCommunity[];
  keywords: string[];
  // MDposit only (empty or null for MDRepo).
  accession: string | null;
  engine: string | null;
  waterModel: string | null;
  method: string | null;
  replicaCount: number | null;
  groups: string[];
};

type RecordAuthor = { name: string; orcid: string | null; affiliations: string[] };

type RecordFile = { key: string; size: number | null; mimetype: string | null };

type RecordLink = { label: string; url: string };

type RecordSequence = { kind: "protein" | "nucleic"; sequence: string };

type SimulationFacts = {
  method: string | null;
  type: string | null;
  ensemble: string | null;
  forceFields: string[];
  waterModel: string | null;
  temperature: number | null;
  timestep: number | null;
  lengthNs: number | null;
  atoms: number | null;
  frames: number | null;
  replicas: number | null;
};

type RecordDetail = Omit<RecordSummary, "authors"> & {
  authors: RecordAuthor[];
  // null = the backend returned no file list (embargoed or restricted for an anonymous caller).
  files: RecordFile[] | null;
  simulation: SimulationFacts | null;
  licenseUrl: string | null;
  citation: string | null;
  acknowledgements: string | null;
  links: RecordLink[];
  pdbIds: string[];
  uniprotIds: string[];
  // Free text on MDposit ("For any questions please send a mail to ..."), sometimes a bare address.
  contact: string | null;
  sequences: RecordSequence[];
  // Names of the MD replicas ("replica 1"), in order.
  replicaNames: string[];
  updatedAt: string | null;
  // Bytes of all files together, null when unknown.
  totalSize: number | null;
};

type RecordSearchResult = {
  // Matches of the whole query (not the page).
  total: number;
  page: number;
  size: number;
  items: RecordSummary[];
  // Only declared checklist facets that the source could count are present.
  facets: Partial<Record<RecordFacetName, RecordFacetOption[]>>;
  // Published records of the whole repository, null when unknown.
  repositoryTotal: number | null;
  // false = counts could not be loaded (partial state).
  facetsAvailable: boolean;
};

export { RECORD_FACETS, RECORD_PAGE_SIZE, RECORD_SORTS };
export type {
  RecordAuthor,
  RecordCommunity,
  RecordDetail,
  RecordFacetName,
  RecordFacetOption,
  RecordFile,
  RecordLink,
  RecordSearchQuery,
  RecordSearchResult,
  RecordSequence,
  RecordSort,
  RecordSummary,
  SimulationFacts,
};
