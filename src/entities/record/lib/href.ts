import { RECORD_PAGE_SIZE, type RecordSearchQuery } from "../model/types";

// Always encodes: callers never build record URLs by string concatenation.
const recordHref = (id: string): string => `/records/${encodeURIComponent(id)}`;

// "/records" or "/records?q=lysozyme". Defaults are omitted (sort "bestmatch", the default page size).
const recordsHref = (
  query: Partial<Pick<RecordSearchQuery, "q" | "sort" | "page" | "size">> & { facets?: RecordSearchQuery["facets"] } = {},
): string => {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.sort && query.sort !== "bestmatch") params.set("sort", query.sort);
  if (query.size && query.size !== RECORD_PAGE_SIZE) params.set("size", String(query.size));
  if (query.page && query.page > 1) params.set("page", String(query.page));
  for (const [name, values] of Object.entries(query.facets ?? {})) for (const value of values) params.append(name, value);
  const text = params.toString();
  return text ? `/records?${text}` : "/records";
};

// BFF route that streams the structure preview (public, 404 when the record has no image).
const recordThumbnailUrl = (id: string): string => `/bff/records/${encodeURIComponent(id)}/thumbnail`;

export { recordHref, recordsHref, recordThumbnailUrl };
