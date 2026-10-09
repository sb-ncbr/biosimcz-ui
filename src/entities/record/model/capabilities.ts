import { RECORD_PAGE_SIZE, type RecordFacetName, type RecordSort } from "./types";

// What a data source can really apply. URL parsing, filters, chips and the sort control render from this, so a filter the
// backend cannot apply is never shown (ux-spec). Plain data: server pages pass it to client components as props.

type FacetKind = "checklist" | "text" | "min-number";

type FacetSpec = {
  name: RecordFacetName;
  title: string;
  kind: FacetKind;
  // Checklist only: show a search box above the options.
  searchable?: boolean;
  // Checklist values are numbers (temperature, timestep): other URL values are dropped.
  numeric?: boolean;
  // Cap of selected values (text and checklist); min-number takes one.
  maxValues: number;
};

type RecordSourceCapabilities = {
  facets: readonly FacetSpec[];
  sorts: readonly RecordSort[];
  sizes: readonly number[];
  defaultSize: number;
};

const SORTS: readonly RecordSort[] = ["bestmatch", "newest", "oldest", "title"];
const SIZES = [10, 20, 50] as const;

// Facets and sorts confirmed against the live API: docs/mdposit-contract.md.
const MDPOSIT_CAPABILITIES: RecordSourceCapabilities = {
  facets: [
    { name: "software", title: "Engine", kind: "checklist", maxValues: 20 },
    { name: "force_field", title: "Force field", kind: "checklist", searchable: true, maxValues: 20 },
    { name: "solvent", title: "Water model", kind: "checklist", maxValues: 20 },
    { name: "method", title: "Method", kind: "checklist", maxValues: 20 },
    { name: "type", title: "Data type", kind: "checklist", maxValues: 20 },
    { name: "collection", title: "Collection", kind: "checklist", searchable: true, maxValues: 20 },
    { name: "ensemble", title: "Ensemble", kind: "checklist", maxValues: 20 },
    { name: "temp", title: "Temperature (K)", kind: "checklist", numeric: true, maxValues: 20 },
    { name: "timestep", title: "Timestep (fs)", kind: "checklist", numeric: true, maxValues: 20 },
    { name: "creator", title: "Author", kind: "text", maxValues: 10 },
    { name: "affiliation", title: "Group", kind: "text", maxValues: 10 },
    { name: "min_atoms", title: "Min. atoms", kind: "min-number", maxValues: 1 },
  ],
  sorts: SORTS,
  sizes: SIZES,
  defaultSize: RECORD_PAGE_SIZE,
};

const MDREPO_CAPABILITIES: RecordSourceCapabilities = {
  facets: [
    { name: "access", title: "Access", kind: "checklist", maxValues: 20 },
    { name: "community", title: "Community", kind: "checklist", searchable: true, maxValues: 20 },
    { name: "software", title: "Engine", kind: "checklist", maxValues: 20 },
    { name: "keyword", title: "Keywords", kind: "checklist", searchable: true, maxValues: 20 },
  ],
  sorts: SORTS,
  sizes: SIZES,
  defaultSize: RECORD_PAGE_SIZE,
};

export { MDPOSIT_CAPABILITIES, MDREPO_CAPABILITIES };
export type { FacetKind, FacetSpec, RecordSourceCapabilities };
