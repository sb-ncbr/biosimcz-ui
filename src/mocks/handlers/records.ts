import { HttpResponse, http, type HttpHandler } from "msw";
import type { MockPublished } from "../fixtures/myDepositions";
import { facetBuckets, matchesFacets, matchesText, obj, readPaging, text, type FacetName, type Json } from "./search";
import type { MockState } from "./state";

// E-R1 (public published-records search) and E-R2 (one record with files), PROPOSED, plans/backend-feature-requests.md
// section 3b. Anonymous on purpose: no authorize() call. Only rows with status "published" exist here; a draft id is a 404.
// TODO(backend): replace the paths with the confirmed ones once the backend answers question Q1 of section 3b.

const RECORD_FACETS = ["access", "community", "engine", "keyword"] as const satisfies readonly FacetName[];

type RecordRow = {
  id: string;
  status: "published";
  title: string | null;
  updated_at: string;
  published_at: string;
  doi: string | null;
  version: number;
  access: string | null;
  community_ids: string[];
  metadata: Json;
  files: { key: string; size: number; mimetype: string }[];
};

// Published rows of the demo seed plus drafts that were published through the wizard in this mock session.
const rowsOf = (state: MockState): RecordRow[] => {
  const seeded = state.published.map(
    (row: MockPublished): RecordRow => ({
      id: row.id,
      status: "published",
      title: row.title,
      updated_at: row.updated_at,
      published_at: row.published_at,
      doi: row.doi,
      version: row.version,
      access: row.access,
      community_ids: row.community_ids,
      metadata: row.metadata,
      files: row.files ?? [],
    }),
  );
  const wizard = [...state.drafts.values()]
    .filter((draft) => draft.status === "published")
    .map((draft): RecordRow => {
      const study = obj(draft.metadata["study"]);
      return {
        id: draft.id,
        status: "published",
        title: text(study["title"]) ?? null,
        updated_at: draft.updated_at,
        published_at: draft.updated_at,
        doi: draft.doi ?? null,
        version: 1,
        access: text(study["access"]) ?? null,
        community_ids: Array.isArray(study["community_ids"]) ? (study["community_ids"] as string[]) : [],
        metadata: draft.metadata,
        files: draft.files.filter((file) => file.status === "completed").map((file) => ({ key: file.key, size: file.size, mimetype: file.mimetype ?? "application/octet-stream" })),
      };
    });
  return [...seeded, ...wizard];
};

const SORTERS: Record<string, (a: RecordRow, b: RecordRow) => number> = {
  published_desc: (a, b) => b.published_at.localeCompare(a.published_at),
  published_asc: (a, b) => a.published_at.localeCompare(b.published_at),
  title_asc: (a, b) => (a.title ?? "").localeCompare(b.title ?? ""),
};

const occurrences = (row: RecordRow, q: string): number => JSON.stringify([row.title, row.metadata]).toLowerCase().split(q).length - 1;

// Anonymous callers never get files of embargoed or restricted records (E-R2 note).
const publicFiles = (row: RecordRow): RecordRow["files"] | undefined => (row.access === "open" ? row.files : undefined);

// The list and the detail carry different file fields: the list never has them.
const withoutFiles = (row: RecordRow): Omit<RecordRow, "files"> => {
  const { files, ...item } = row;
  void files;
  return item;
};

const recordsHandlers = (state: MockState): HttpHandler[] => [
  http.get("*/api/records/:id", ({ params }) => {
    const row = rowsOf(state).find((candidate) => candidate.id === String(params["id"]));
    if (!row) return HttpResponse.json({ message: "Not found" }, { status: 404 });
    const item = withoutFiles(row);
    const files = publicFiles(row);
    return HttpResponse.json({
      ...item,
      ...(files !== undefined && { files }),
      communities: row.community_ids.flatMap((id) => {
        const community = state.communities.find((candidate) => candidate.id === id);
        return community ? [{ id, slug: community.slug, title: community.metadata.title }] : [];
      }),
    });
  }),

  http.get("*/api/records", ({ request }) => {
    const params = new URL(request.url).searchParams;
    const q = params.get("q")?.trim().toLowerCase() ?? "";
    const wanted = Object.fromEntries(RECORD_FACETS.map((name) => [name, params.getAll(name)])) as Record<(typeof RECORD_FACETS)[number], string[]>;
    const rows = rowsOf(state);

    const matching = rows.filter((row) => matchesText(row, q) && matchesFacets(row, wanted, state));
    const sortName = params.get("sort") ?? "relevance";
    const sorter = q && sortName === "relevance" ? (a: RecordRow, b: RecordRow) => occurrences(b, q) - occurrences(a, q) || SORTERS["published_desc"]!(a, b) : (SORTERS[sortName] ?? SORTERS["published_desc"]!);
    const selected = [...matching].sort(sorter);

    const { page, size } = readPaging(params);
    const items = selected.slice((page - 1) * size, page * size).map(withoutFiles);
    const forFacet = (except: FacetName) => rows.filter((row) => matchesText(row, q) && matchesFacets(row, wanted, state, except));

    return HttpResponse.json({
      total: selected.length,
      page,
      size,
      items,
      facets: Object.fromEntries(RECORD_FACETS.map((name) => [name, facetBuckets(forFacet(name), name, state)])),
    });
  }),
];

export { recordsHandlers };
