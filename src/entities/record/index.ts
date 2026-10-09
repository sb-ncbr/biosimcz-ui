// Client-safe surface of the record entity: pure types, URL helpers and the presentational card.
export { recordHref, recordsHref, recordThumbnailUrl } from "./lib/href";
export { isRecordId } from "./lib/recordId";
export { MDPOSIT_CAPABILITIES, MDREPO_CAPABILITIES } from "./model/capabilities";
export type { FacetKind, FacetSpec, RecordSourceCapabilities } from "./model/capabilities";
export { RECORD_FACETS, RECORD_PAGE_SIZE, RECORD_SORTS } from "./model/types";
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
} from "./model/types";
export { RecordCard } from "./ui/RecordCard";
export { RecordThumbnail } from "./ui/RecordThumbnail";
