import "server-only";
import { MDREPO_CAPABILITIES, type RecordFacetName, type RecordSearchQuery, type RecordSort } from "@/entities/record";
import { getRecord, searchRecords, type RecordSearchWireQuery } from "../../backends/mdrepo/records";
import { isApiError } from "../../http/errors";
import { fromDetailResponse, fromSearchResponse } from "./mapper";
import type { RecordRepository } from "./types";

// Domain names -> the E-R1 wire names (PROPOSED).
const WIRE_SORT: Record<RecordSort, string | undefined> = { bestmatch: undefined, newest: "published_desc", oldest: "published_asc", title: "title_asc" };
const WIRE_FACET: Partial<Record<RecordFacetName, string>> = { access: "access", community: "community", software: "engine", keyword: "keyword" };

// Only sends what the user actually chose, so the backend applies its own defaults for the rest.
const toWireQuery = (query: RecordSearchQuery): RecordSearchWireQuery => {
  const wire: RecordSearchWireQuery = { page: query.page, size: query.size };
  if (query.q) wire.q = query.q;
  const sort = WIRE_SORT[query.sort];
  if (sort) wire.sort = sort;
  for (const [name, values] of Object.entries(query.facets)) {
    const wireName = WIRE_FACET[name as RecordFacetName];
    if (wireName && values.length > 0) (wire as Record<string, unknown>)[wireName] = values;
  }
  return wire;
};

const mdrepoRecordRepository: RecordRepository = {
  capabilities: MDREPO_CAPABILITIES,
  search: async (query) => fromSearchResponse((await searchRecords(toWireQuery(query))).data),
  get: async (id) => {
    try {
      return fromDetailResponse((await getRecord(id)).data);
    } catch (error) {
      if (isApiError(error) && error.kind === "not_found") return null;
      throw error;
    }
  },
};

export { mdrepoRecordRepository, toWireQuery };
