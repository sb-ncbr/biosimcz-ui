import type { MockState } from "./state";

// Faceted-search helpers shared by the E-L1 ("my depositions") and E-R1 (public records) mocks. Facet counts follow
// standard faceted search: each facet ignores its own filter.

type Json = Record<string, unknown>;

// What the helpers need of a row; both mocks' rows satisfy it.
type SearchRow = { title: string | null; access: string | null; community_ids: string[]; metadata: Json };

const FACET_NAMES = ["access", "community", "structure", "engine", "author", "funder", "keyword"] as const;
type FacetName = (typeof FACET_NAMES)[number];

const obj = (value: unknown): Json => (typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Json) : {});
const list = (value: unknown): Json[] => (Array.isArray(value) ? value.map(obj) : []);
const text = (value: unknown): string | undefined => (typeof value === "string" && value !== "" ? value : undefined);

const authorKey = (author: Json): string | undefined => {
  const family = text(author["family_name"]);
  const initial = text(author["given_name"])?.charAt(0).toUpperCase();
  return text(author["orcid"]) ?? (family ? `${family}${initial ? ` ${initial}.` : ""}` : text(author["name"]));
};

// Facet values of one row, as [key, label] pairs.
const valuesOf = (row: SearchRow, name: FacetName, state: MockState): [string, string][] => {
  const study = obj(row.metadata["study"]);
  const system = obj(row.metadata["system"]);
  switch (name) {
    case "access":
      return row.access ? [[row.access, row.access]] : [];
    case "community":
      return row.community_ids.map((id): [string, string] => [id, text(obj(state.communities.find((c) => c.id === id)?.metadata)["title"]) ?? id]);
    case "structure": {
      const structure = obj(system["starting_structure"]);
      const id = text(structure["id"]);
      return id ? [[id, text(structure["title"]) ?? id]] : [];
    }
    case "engine": {
      const engine = text(obj(system["engine"])["name"]);
      return engine ? [[engine, engine]] : [];
    }
    case "author":
      return list(study["authors"]).flatMap((author) => {
        const key = authorKey(author);
        return key ? [[key, key] as [string, string]] : [];
      });
    case "funder":
      return list(study["funding"]).flatMap((funding) => {
        const name = text(funding["funder_name"]);
        return name ? [[name, name] as [string, string]] : [];
      });
    case "keyword":
      return (Array.isArray(study["keywords"]) ? study["keywords"] : []).flatMap((keyword) => (typeof keyword === "string" ? [[keyword, keyword] as [string, string]] : []));
  }
};

const matchesText = (row: SearchRow, q: string | undefined): boolean =>
  !q || JSON.stringify([row.title, row.metadata]).toLowerCase().includes(q);

// `except` is the facet being counted: it ignores its own filter.
const matchesFacets = (row: SearchRow, wantedBy: Partial<Record<FacetName, string[]>>, state: MockState, except?: FacetName): boolean =>
  FACET_NAMES.every((name) => {
    const wanted = wantedBy[name] ?? [];
    if (name === except || wanted.length === 0) return true;
    const have = valuesOf(row, name, state).map(([key]) => key);
    return wanted.some((key) => have.includes(key));
  });

const facetBuckets = (rows: SearchRow[], name: FacetName, state: MockState) => {
  const counts = new Map<string, { label: string; count: number }>();
  for (const row of rows) {
    for (const [key, label] of new Map(valuesOf(row, name, state))) {
      counts.set(key, { label, count: (counts.get(key)?.count ?? 0) + 1 });
    }
  }
  return [...counts.entries()].sort(([, a], [, b]) => b.count - a.count).map(([key, { label, count }]) => ({ key, label, count }));
};

// page >= 1, 1 <= size <= 100 (backend doc: default 20, max 100).
const readPaging = (params: URLSearchParams): { page: number; size: number } => ({
  size: Math.min(100, Math.max(1, Number(params.get("size") ?? 20) || 20)),
  page: Math.max(1, Number(params.get("page") ?? 1) || 1),
});

export { FACET_NAMES, facetBuckets, list, matchesFacets, matchesText, obj, readPaging, text, valuesOf };
export type { FacetName, Json, SearchRow };
