import {
  DATE_GRANULARITIES,
  FACET_NAMES,
  isValidIsoDate,
  LIST_SORTS,
  LIST_STATUSES,
  type DateGranularity,
  type DepositionListQuery,
  type FacetName,
  type ListSort,
  type ListStatus,
} from "@/entities/deposition";
import { asList, first, oneOf, readFacetValues as readValues, toRaw, type FacetLimits, type RawParams } from "@/shared/lib";

// URL is the single source of truth of the list (plan 3.2): every filter, tab, search, sort and page round-trips
// through it, so links are shareable and reload-safe. Defaults are omitted from the URL.

const DEFAULT_SORT: ListSort = "updated_desc";
const DEFAULT_GRANULARITY: DateGranularity = "year";
const MAX_QUERY_CHARS = 200;
const MAX_VALUE_CHARS = 100;
const MAX_VALUES_PER_FACET = 20;
const MAX_PAGE = 10_000;
const FACET_LIMITS: FacetLimits = { maxValues: MAX_VALUES_PER_FACET, maxChars: MAX_VALUE_CHARS };

const readFacetValues = (raw: string[]): string[] => readValues(raw, FACET_LIMITS);

// Explicit keys keep the record exhaustive for the type checker (Object.fromEntries would widen it).
const buildFacets = (read: (name: FacetName) => readonly string[]): DepositionListQuery["facets"] => ({
  access: read("access"),
  community: read("community"),
  structure: read("structure"),
  engine: read("engine"),
  author: read("author"),
  funder: read("funder"),
  keyword: read("keyword"),
});

const emptyFacets = (): DepositionListQuery["facets"] => buildFacets(() => []);

const defaultQuery = (): DepositionListQuery => ({
  status: "all",
  q: "",
  sort: DEFAULT_SORT,
  page: 1,
  by: DEFAULT_GRANULARITY,
  createdFrom: null,
  createdTo: null,
  facets: emptyFacets(),
});

const readDate = (value: string | undefined): string | null => (value !== undefined && isValidIsoDate(value) ? value : null);

// Tolerant on purpose: a hand-edited or stale URL must never throw, it just falls back to defaults.
const parseListQuery = (input: RawParams | URLSearchParams): DepositionListQuery => {
  const raw = toRaw(input);
  const page = Number.parseInt(first(raw["page"]) ?? "1", 10);
  const from = readDate(first(raw["from"]));
  const to = readDate(first(raw["to"]));
  return {
    status: oneOf<ListStatus>(LIST_STATUSES, first(raw["status"]), "all"),
    q: (first(raw["q"]) ?? "").trim().slice(0, MAX_QUERY_CHARS),
    sort: oneOf<ListSort>(LIST_SORTS, first(raw["sort"]), DEFAULT_SORT),
    page: Number.isInteger(page) && page >= 1 ? Math.min(page, MAX_PAGE) : 1,
    by: oneOf<DateGranularity>(DATE_GRANULARITIES, first(raw["by"]), DEFAULT_GRANULARITY),
    // A reversed range would match nothing; dropping the upper bound keeps the lower one useful.
    createdFrom: from,
    createdTo: from !== null && to !== null && to < from ? null : to,
    facets: buildFacets((name) => readFacetValues(asList(raw[name]))),
  };
};

const toSearchParams = (query: DepositionListQuery): URLSearchParams => {
  const params = new URLSearchParams();
  if (query.status !== "all") params.set("status", query.status);
  if (query.q) params.set("q", query.q);
  if (query.sort !== DEFAULT_SORT) params.set("sort", query.sort);
  if (query.page > 1) params.set("page", String(query.page));
  if (query.by !== DEFAULT_GRANULARITY) params.set("by", query.by);
  if (query.createdFrom) params.set("from", query.createdFrom);
  if (query.createdTo) params.set("to", query.createdTo);
  for (const name of FACET_NAMES) for (const value of query.facets[name]) params.append(name, value);
  return params;
};

// "" or "?a=b", ready to append to a pathname.
const serializeListQuery = (query: DepositionListQuery): string => {
  const text = toSearchParams(query).toString();
  return text ? `?${text}` : "";
};

// ---- Transitions. Anything that changes the result set goes back to page 1. ----------------------------------

const resetPage = (query: DepositionListQuery): DepositionListQuery => ({ ...query, page: 1 });

const setStatus = (query: DepositionListQuery, status: ListStatus): DepositionListQuery => resetPage({ ...query, status });
const setSearch = (query: DepositionListQuery, q: string): DepositionListQuery => resetPage({ ...query, q: q.trim().slice(0, MAX_QUERY_CHARS) });
const setSort = (query: DepositionListQuery, sort: ListSort): DepositionListQuery => resetPage({ ...query, sort });
const setPage = (query: DepositionListQuery, page: number): DepositionListQuery => ({ ...query, page: Math.max(1, Math.trunc(page)) });
const setGranularity = (query: DepositionListQuery, by: DateGranularity): DepositionListQuery => ({ ...query, by });

const setDateRange = (query: DepositionListQuery, createdFrom: string | null, createdTo: string | null): DepositionListQuery =>
  resetPage({ ...query, createdFrom, createdTo });

const setFacet = (query: DepositionListQuery, name: FacetName, values: readonly string[]): DepositionListQuery =>
  resetPage({ ...query, facets: { ...query.facets, [name]: readFacetValues([...values]) } });

const toggleFacetValue = (query: DepositionListQuery, name: FacetName, value: string): DepositionListQuery => {
  const current = query.facets[name];
  return setFacet(query, name, current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
};

// "Clear all" of the filters column and the chips row: facets and dates, never the tab, the search or the sort.
const clearFilters = (query: DepositionListQuery): DepositionListQuery =>
  resetPage({ ...query, createdFrom: null, createdTo: null, facets: emptyFacets() });

const facetFilterCount = (query: DepositionListQuery, name: FacetName): number => query.facets[name].length;

// Date range counts as one active filter (Figma "Filters 1" for one selected community).
const activeFilterCount = (query: DepositionListQuery): number =>
  FACET_NAMES.reduce((sum, name) => sum + query.facets[name].length, 0) + (query.createdFrom || query.createdTo ? 1 : 0);

const hasActiveFilters = (query: DepositionListQuery): boolean => activeFilterCount(query) > 0;

// ---- Date input ("Year, month or day, e.g. 2025-03-09") ------------------------------------------------------

const lastDayOfMonth = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate();

// "2025" -> 2025-01-01 / 2025-12-31, "2025-03" -> 2025-03-01 / 2025-03-31, a full date stays. null = not a date.
const parseDateInput = (text: string, edge: "from" | "to"): string | null => {
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(text.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = match[2] === undefined ? undefined : Number(match[2]);
  const day = match[3] === undefined ? undefined : Number(match[3]);
  if (month !== undefined && (month < 1 || month > 12)) return null;
  const resolvedMonth = month ?? (edge === "from" ? 1 : 12);
  const resolvedDay = day ?? (edge === "from" ? 1 : lastDayOfMonth(year, resolvedMonth));
  const iso = `${String(year).padStart(4, "0")}-${String(resolvedMonth).padStart(2, "0")}-${String(resolvedDay).padStart(2, "0")}`;
  return isValidIsoDate(iso) ? iso : null;
};

// The bucket key of the histogram ("2026" or "2026-09") as an inclusive range.
const bucketRange = (key: string): { from: string; to: string } | null => {
  const from = parseDateInput(key, "from");
  const to = parseDateInput(key, "to");
  return from && to ? { from, to } : null;
};

export {
  activeFilterCount,
  bucketRange,
  clearFilters,
  defaultQuery,
  facetFilterCount,
  hasActiveFilters,
  parseDateInput,
  parseListQuery,
  serializeListQuery,
  setDateRange,
  setFacet,
  setGranularity,
  setPage,
  setSearch,
  setSort,
  setStatus,
  toggleFacetValue,
};
export type { RawParams };
