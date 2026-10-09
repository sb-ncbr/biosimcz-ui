import { HttpResponse, http, type HttpHandler } from "msw";
import { demoDrafts, publishedDepositions, type MockPublished } from "../fixtures/myDepositions";
import { authorize } from "./auth";
import { FACET_NAMES, facetBuckets, matchesFacets, matchesText, obj, readPaging, text, type FacetName, type Json } from "./search";
import type { MockState } from "./state";

// E-L1 "my depositions" (PROPOSED, plans/backend-feature-requests.md section 3): user-scoped search with status, q,
// sort, page and faceted filters. Facet counts follow standard faceted search: each facet ignores its own filter.
// TODO(backend): replace the path with the confirmed one once the backend delivers E-L1.

type Row = {
  id: string;
  status: string;
  title: string | null;
  updated_at: string;
  created_at: string;
  published_at: string | null;
  doi: string | null;
  version?: number;
  access: string | null;
  community_ids: string[];
  has_preview: boolean;
  metadata: Json;
};

type Filters = { q?: string; from?: string; to?: string; facets: Record<FacetName, string[]> };

const readFilters = (params: URLSearchParams): Filters => ({
  ...(params.get("q") && { q: params.get("q")!.toLowerCase() }),
  ...(params.get("created_from") && { from: params.get("created_from")! }),
  ...(params.get("created_to") && { to: params.get("created_to")! }),
  facets: Object.fromEntries(FACET_NAMES.map((name) => [name, params.getAll(name)])) as Record<FacetName, string[]>,
});

const matches = (row: Row, filters: Filters, state: MockState, except?: FacetName | "date"): boolean => {
  if (!matchesText(row, filters.q)) return false;
  if (except !== "date") {
    const day = row.created_at.slice(0, 10);
    if (filters.from && day < filters.from) return false;
    if (filters.to && day > filters.to) return false;
  }
  return matchesFacets(row, filters.facets, state, except === "date" ? undefined : except);
};

const rowsOf = (state: MockState): Row[] => {
  const drafts = [...state.drafts.values()].map((draft): Row => {
    const study = obj(draft.metadata["study"]);
    return {
      id: draft.id,
      status: draft.status,
      title: text(study["title"]) ?? null,
      updated_at: draft.updated_at,
      created_at: draft.created_at,
      published_at: draft.status === "published" ? draft.updated_at : null,
      doi: draft.doi ?? null,
      access: text(study["access"]) ?? null,
      community_ids: Array.isArray(study["community_ids"]) ? (study["community_ids"] as string[]) : [],
      has_preview: false,
      metadata: draft.metadata,
    };
  });
  return [...drafts, ...state.published.map((published: MockPublished): Row => ({ ...published, has_preview: false }))];
};

const SORTERS: Record<string, (a: Row, b: Row) => number> = {
  updated_desc: (a, b) => b.updated_at.localeCompare(a.updated_at),
  updated_asc: (a, b) => a.updated_at.localeCompare(b.updated_at),
  created_desc: (a, b) => b.created_at.localeCompare(a.created_at),
  title_asc: (a, b) => (a.title ?? "").localeCompare(b.title ?? ""),
};

const myDepositionsHandlers = (state: MockState): HttpHandler[] => {
  const guard = (request: Request) => authorize(state, request);
  return [
    http.get("*/api/me/experiments/facets/:name", ({ request, params }) => {
      const denied = guard(request);
      if (denied) return denied;
      const name = String(params["name"]) as FacetName;
      if (!FACET_NAMES.includes(name)) return HttpResponse.json({ items: [] });
      const url = new URL(request.url);
      const needle = url.searchParams.get("q")?.toLowerCase();
      const items = facetBuckets(rowsOf(state), name, state).filter((bucket) => !needle || bucket.label.toLowerCase().includes(needle));
      return HttpResponse.json({ items: items.slice(0, Number(url.searchParams.get("size") ?? 20)) });
    }),

    http.get("*/api/me/experiments", ({ request }) => {
      const denied = guard(request);
      if (denied) return denied;
      const params = new URL(request.url).searchParams;
      const status = params.get("status") ?? "all";
      const filters = readFilters(params);
      const rows = rowsOf(state);

      const inScope = rows.filter((row) => matches(row, filters, state));
      const wantsStatus = (row: Row) => status === "all" || (status === "draft" ? row.status === "draft" : row.status !== "draft");
      const selected = inScope.filter(wantsStatus).sort(SORTERS[params.get("sort") ?? "updated_desc"] ?? SORTERS["updated_desc"]!);

      const { page, size } = readPaging(params);
      const pageRows = selected.slice((page - 1) * size, page * size);

      // Facets: every facet counts rows that match all the other filters and the tab.
      const forFacet = (except: FacetName | "date") => rows.filter((row) => wantsStatus(row) && matches(row, filters, state, except));
      const months = new Map<string, number>();
      for (const row of forFacet("date")) months.set(row.created_at.slice(0, 7), (months.get(row.created_at.slice(0, 7)) ?? 0) + 1);

      return HttpResponse.json({
        total: selected.length,
        page,
        size,
        counts_by_status: {
          all: inScope.length,
          draft: inScope.filter((row) => row.status === "draft").length,
          published: inScope.filter((row) => row.status !== "draft").length,
        },
        items: pageRows,
        facets: {
          created: { interval: "month", buckets: [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => ({ key, count })) },
          ...Object.fromEntries(FACET_NAMES.map((name) => [name, facetBuckets(forFacet(name), name, state)])),
        },
      });
    }),
  ];
};

// Demo data (Figma copy) for the standalone mock server. Tests start from createMockState only (two drafts, no
// published rows), so every E-L1 row comes from MockState.
const seedMyDepositionsDemo = (state: MockState): void => {
  for (const draft of demoDrafts()) state.drafts.set(draft.id, draft);
  state.published = structuredClone(publishedDepositions);
};

export { myDepositionsHandlers, seedMyDepositionsDemo };
