import {
  RECORD_FACETS,
  RECORD_PAGE_SIZE,
  RECORD_SORTS,
  type FacetSpec,
  type RecordFacetName,
  type RecordSearchQuery,
  type RecordSort,
  type RecordSourceCapabilities,
} from "@/entities/record";
import { asList, first, oneOf, readFacetValues as readValues, toRaw, type FacetLimits, type RawParams } from "@/shared/lib";

// The URL is the single source of truth of the public search: q, sort, size, page and the facets the data source declares
// round-trip through it, so links are shareable and reload-safe. Defaults are omitted from the URL. Keys the source does
// not declare (old filters, hand-edited values) are ignored.

const DEFAULT_SORT: RecordSort = "bestmatch";
const MAX_QUERY_CHARS = 200;
const MAX_PAGE = 10_000;
const MAX_CHARS = 100;
const MAX_MIN_NUMBER = 1_000_000_000;

// Links of the first new-UI release and the old UI.
const LEGACY_SORTS: Readonly<Record<string, RecordSort>> = {
  relevance: "bestmatch",
  published_desc: "newest",
  published_asc: "oldest",
  title_asc: "title",
};

const limitsOf = (spec: FacetSpec): FacetLimits => ({ maxValues: spec.maxValues, maxChars: MAX_CHARS });

const isNumeric = (value: string): boolean => /^-?\d+(\.\d+)?$/.test(value) && Number.isFinite(Number(value));

const readFacet = (spec: FacetSpec, raw: string[]): string[] => {
  if (spec.kind === "min-number") {
    const value = raw[0]?.trim() ?? "";
    return /^\d{1,10}$/.test(value) && Number(value) <= MAX_MIN_NUMBER ? [String(Number(value))] : [];
  }
  const values = readValues(raw, limitsOf(spec));
  return spec.numeric ? values.filter(isNumeric) : values;
};

const defaultRecordQuery = (): RecordSearchQuery => ({ q: "", sort: DEFAULT_SORT, page: 1, size: RECORD_PAGE_SIZE, facets: {} });

// Tolerant on purpose: a hand-edited or stale URL must never throw, it just falls back to defaults.
const parseRecordQuery = (input: RawParams | URLSearchParams, capabilities: RecordSourceCapabilities): RecordSearchQuery => {
  const raw = toRaw(input);
  const page = Number.parseInt(first(raw["page"]) ?? "1", 10);
  const requestedSort = first(raw["sort"]);
  const legacy = requestedSort !== undefined && Object.hasOwn(LEGACY_SORTS, requestedSort) ? LEGACY_SORTS[requestedSort] : undefined;
  const sort = legacy ?? oneOf<RecordSort>(RECORD_SORTS, requestedSort, DEFAULT_SORT);
  const size = Number.parseInt(first(raw["size"]) ?? "", 10);

  const facets: RecordSearchQuery["facets"] = {};
  for (const spec of capabilities.facets) {
    // Own-property read: a key like "__proto__" in the URL never reaches an object.
    const values = Object.hasOwn(raw, spec.name) ? readFacet(spec, asList(raw[spec.name])) : [];
    if (values.length > 0) facets[spec.name] = values;
  }
  return {
    // Only spaces count as an empty search.
    q: (first(raw["q"]) ?? "").trim().slice(0, MAX_QUERY_CHARS),
    sort: capabilities.sorts.includes(sort) ? sort : DEFAULT_SORT,
    page: Number.isInteger(page) && page >= 1 ? Math.min(page, MAX_PAGE) : 1,
    size: capabilities.sizes.includes(size) ? size : capabilities.defaultSize,
    facets,
  };
};

const facetValues = (query: RecordSearchQuery, name: RecordFacetName): readonly string[] => query.facets[name] ?? [];

// "" or "?a=b", ready to append to a pathname.
const serializeRecordQuery = (query: RecordSearchQuery): string => {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.sort !== DEFAULT_SORT) params.set("sort", query.sort);
  if (query.size !== RECORD_PAGE_SIZE) params.set("size", String(query.size));
  if (query.page > 1) params.set("page", String(query.page));
  for (const name of RECORD_FACETS) for (const value of facetValues(query, name)) params.append(name, value);
  const text = params.toString();
  return text ? `?${text}` : "";
};

// ---- Transitions. Anything that changes the result set goes back to page 1. ----------------------------------

const resetPage = (query: RecordSearchQuery): RecordSearchQuery => ({ ...query, page: 1 });

const withFacet = (query: RecordSearchQuery, name: RecordFacetName, values: readonly string[]): RecordSearchQuery => {
  const { [name]: removed, ...rest } = query.facets;
  void removed;
  return resetPage({ ...query, facets: values.length > 0 ? { ...rest, [name]: values } : rest });
};

const setRecordSearch = (query: RecordSearchQuery, q: string): RecordSearchQuery => resetPage({ ...query, q: q.trim().slice(0, MAX_QUERY_CHARS) });
const setRecordSort = (query: RecordSearchQuery, sort: RecordSort): RecordSearchQuery => resetPage({ ...query, sort });
const setRecordSize = (query: RecordSearchQuery, size: number): RecordSearchQuery => resetPage({ ...query, size });
const setRecordPage = (query: RecordSearchQuery, page: number): RecordSearchQuery => ({ ...query, page: Math.max(1, Math.trunc(page)) });

// Replaces the values of one facet (text facet commit, min-number Apply); the caller passes already validated text.
const setRecordFacet = (query: RecordSearchQuery, spec: FacetSpec, values: readonly string[]): RecordSearchQuery =>
  withFacet(query, spec.name, readFacet(spec, [...values]));

const toggleRecordFacet = (query: RecordSearchQuery, spec: FacetSpec, value: string): RecordSearchQuery => {
  const current = facetValues(query, spec.name);
  return setRecordFacet(query, spec, current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
};

// "Clear all filters": the facets only, never the search, the sort or the page size.
const clearRecordFilters = (query: RecordSearchQuery): RecordSearchQuery => resetPage({ ...query, facets: {} });

const activeRecordFilterCount = (query: RecordSearchQuery): number => RECORD_FACETS.reduce((sum, name) => sum + facetValues(query, name).length, 0);

const hasRecordFilters = (query: RecordSearchQuery): boolean => activeRecordFilterCount(query) > 0;

export {
  activeRecordFilterCount,
  clearRecordFilters,
  defaultRecordQuery,
  facetValues,
  hasRecordFilters,
  parseRecordQuery,
  serializeRecordQuery,
  setRecordFacet,
  setRecordPage,
  setRecordSearch,
  setRecordSize,
  setRecordSort,
  toggleRecordFacet,
};
