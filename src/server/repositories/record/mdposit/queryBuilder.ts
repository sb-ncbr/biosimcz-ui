import type { RecordFacetName, RecordSearchQuery, RecordSort } from "@/entities/record";

// Domain query -> MDposit request params. SECURITY: `query` is a raw MongoDB filter on the MDposit side, so it is built
// here from a fixed allowlist and nothing the user typed ever becomes a key or an operator:
//  - fields come from FACET_FIELDS only (never from user keys),
//  - operators are limited to $and, $in, $gte, $regex and $options, all written by this file,
//  - user text is only ever a VALUE: strings starting with "$" are dropped, regex text is escaped and length-capped,
//  - numbers are parsed and range-checked, counts and total size are capped.
// Pure functions, no I/O, so every rule is unit-tested.

type Filter = Record<string, unknown>;

type FacetField =
  | { field: string; kind: "in-text" }
  | { field: string; kind: "in-number"; min: number; max: number }
  | { field: string; kind: "contains" }
  | { field: string; kind: "min-integer"; max: number };

// The only fields a facet may touch. Names confirmed against the live API (docs/mdposit-contract.md); atom count is SYSTATS.
const FACET_FIELDS: Partial<Record<RecordFacetName, FacetField>> = {
  software: { field: "metadata.PROGRAM", kind: "in-text" },
  force_field: { field: "metadata.FF", kind: "in-text" },
  solvent: { field: "metadata.WAT", kind: "in-text" },
  method: { field: "metadata.METHOD", kind: "in-text" },
  type: { field: "metadata.TYPE", kind: "in-text" },
  collection: { field: "metadata.COLLECTIONS", kind: "in-text" },
  ensemble: { field: "metadata.ENSEMBLE", kind: "in-text" },
  temp: { field: "metadata.TEMP", kind: "in-number", min: 0, max: 10_000 },
  timestep: { field: "metadata.TIMESTEP", kind: "in-number", min: 0, max: 100 },
  creator: { field: "metadata.AUTHORS", kind: "contains" },
  affiliation: { field: "metadata.GROUPS", kind: "contains" },
  min_atoms: { field: "metadata.SYSTATS", kind: "min-integer", max: 1_000_000_000 },
};

const MAX_SEARCH_CHARS = 200;
const MAX_VALUE_CHARS = 100;
const MAX_CHECKLIST_VALUES = 20;
const MAX_TEXT_VALUES = 10;
const MAX_FILTER_CHARS = 4096;
const MAX_LIMIT = 100;
const MAX_PAGE = 10_000;

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\\-/]/g, "\\$&");

// A usable user value: a string, trimmed, not empty, not too long, and never operator-like ("$where", "$ne").
const cleanText = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (text === "" || text.length > MAX_VALUE_CHARS || text.startsWith("$")) return null;
  return text;
};

const cleanTexts = (values: readonly unknown[], max: number): string[] => [
  ...new Set(values.map(cleanText).filter((text): text is string => text !== null)),
].slice(0, max);

const cleanNumber = (value: unknown, min: number, max: number): number | null => {
  if (typeof value !== "string" || !/^-?\d+(\.\d+)?$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
};

const clauseFor = (spec: FacetField, values: readonly unknown[]): Filter[] => {
  switch (spec.kind) {
    case "in-text": {
      const texts = cleanTexts(values, MAX_CHECKLIST_VALUES);
      return texts.length > 0 ? [{ [spec.field]: { $in: texts } }] : [];
    }
    case "in-number": {
      const numbers = [...new Set(values.map((value) => cleanNumber(value, spec.min, spec.max)).filter((n): n is number => n !== null))].slice(
        0,
        MAX_CHECKLIST_VALUES,
      );
      return numbers.length > 0 ? [{ [spec.field]: { $in: numbers } }] : [];
    }
    // Each value narrows the result (author A AND author B); the text is escaped, so it can only match literally.
    case "contains":
      return cleanTexts(values, MAX_TEXT_VALUES).map((text) => ({ [spec.field]: { $regex: escapeRegExp(text), $options: "i" } }));
    case "min-integer": {
      const number = cleanNumber(values[0], 0, spec.max);
      return number !== null && Number.isInteger(number) ? [{ [spec.field]: { $gte: number } }] : [];
    }
  }
};

type BuiltFilter = { filter: Filter | undefined; dropped: number };

// `except` leaves one facet out: its own options are counted without its own selection (standard faceted search).
const buildFilter = (facets: RecordSearchQuery["facets"], except?: RecordFacetName): BuiltFilter => {
  const clauses: Filter[] = [];
  for (const [name, spec] of Object.entries(FACET_FIELDS) as [RecordFacetName, FacetField][]) {
    if (name === except) continue;
    // Own-property read: the keys of `facets` are never iterated, so a hostile key cannot reach the filter.
    const values = Object.hasOwn(facets, name) ? facets[name] : undefined;
    if (Array.isArray(values)) clauses.push(...clauseFor(spec, values));
  }
  const wrap = (list: Filter[]): Filter | undefined => (list.length === 0 ? undefined : list.length === 1 ? list[0] : { $and: list });
  let kept = clauses;
  while (kept.length > 0 && JSON.stringify(wrap(kept)).length > MAX_FILTER_CHARS) kept = kept.slice(0, -1);
  return { filter: wrap(kept), dropped: clauses.length - kept.length };
};

const sortFor = (sort: RecordSort, hasText: boolean): Record<string, 1 | -1> | undefined => {
  switch (sort) {
    case "bestmatch":
      // With text the server's own order stays; without it, newest first like the old list.
      return hasText ? undefined : { _id: -1 };
    case "newest":
      return { _id: -1 };
    case "oldest":
      return { _id: 1 };
    case "title":
      return { "metadata.NAME": 1 };
  }
};

type ProjectsRequest = {
  search?: string;
  query?: string;
  sort?: Record<string, 1 | -1>;
  page: number;
  limit: number;
};

const clampInt = (value: number, min: number, max: number, fallback: number): number =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, Math.trunc(value))) : fallback;

const buildProjectsRequest = (query: RecordSearchQuery): { request: ProjectsRequest; dropped: number } => {
  const search = typeof query.q === "string" ? query.q.trim().slice(0, MAX_SEARCH_CHARS) : "";
  const { filter, dropped } = buildFilter(query.facets);
  const sort = sortFor(query.sort, search !== "");
  return {
    request: {
      ...(search !== "" && { search }),
      ...(filter && { query: JSON.stringify(filter) }),
      ...(sort && { sort }),
      page: clampInt(query.page, 1, MAX_PAGE, 1),
      limit: clampInt(query.size, 1, MAX_LIMIT, 20),
    },
    dropped,
  };
};

type OptionsRequest = { projection: string; query?: string };

// null = the facet has no options call (not an allowlisted field).
const buildOptionsRequest = (facet: RecordFacetName, facets: RecordSearchQuery["facets"]): OptionsRequest | null => {
  const spec = FACET_FIELDS[facet];
  if (!spec) return null;
  const { filter } = buildFilter(facets, facet);
  return { projection: spec.field, ...(filter && { query: JSON.stringify(filter) }) };
};

export { buildFilter, buildOptionsRequest, buildProjectsRequest, escapeRegExp, FACET_FIELDS, MAX_FILTER_CHARS, MAX_VALUE_CHARS };
export type { BuiltFilter, Filter, OptionsRequest, ProjectsRequest };
