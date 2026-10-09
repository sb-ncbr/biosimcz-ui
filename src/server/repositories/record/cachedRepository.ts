import "server-only";
import type { RecordSearchQuery } from "@/entities/record";
import { createTtlCache } from "../../lib/ttlCache";
import type { RecordRepository } from "./types";

type CacheTtl = { searchMs: number; getMs: number };

// Same query, same key: facet values are sorted and absent or empty facets are dropped, so equal searches share an entry.
const searchKey = (query: RecordSearchQuery): string =>
  JSON.stringify({
    q: query.q.trim(),
    sort: query.sort,
    page: query.page,
    size: query.size,
    facets: Object.entries(query.facets)
      .filter(([, values]) => values.length > 0)
      .map(([name, values]) => [name, [...values].sort()])
      .sort(([a], [b]) => String(a).localeCompare(String(b))),
  });

// Short in-memory cache for anonymous public data (bounded, LRU). Errors and unknown ids (null) are never cached, so a
// record that is published a moment later shows up at once.
const withCache = (repository: RecordRepository, ttl: CacheTtl): RecordRepository => {
  const searches = createTtlCache<Awaited<ReturnType<RecordRepository["search"]>>>();
  const records = createTtlCache<NonNullable<Awaited<ReturnType<RecordRepository["get"]>>>>();
  return {
    capabilities: repository.capabilities,
    search: async (query) => {
      const key = searchKey(query);
      const hit = searches.get(key);
      if (hit) return hit;
      const result = await repository.search(query);
      searches.set(key, result, ttl.searchMs);
      return result;
    },
    get: async (id) => {
      const hit = records.get(id);
      if (hit) return hit;
      const record = await repository.get(id);
      if (record) records.set(id, record, ttl.getMs);
      return record;
    },
  };
};

export { searchKey, withCache };
export type { CacheTtl };
