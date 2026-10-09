import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MDPOSIT_CAPABILITIES, RECORD_PAGE_SIZE, type RecordDetail, type RecordSearchQuery, type RecordSearchResult } from "@/entities/record";
import { searchKey, withCache } from "./cachedRepository";
import type { RecordRepository } from "./types";

const query = (overrides: Partial<RecordSearchQuery> = {}): RecordSearchQuery => ({ q: "", sort: "bestmatch", page: 1, size: RECORD_PAGE_SIZE, facets: {}, ...overrides });
const result = { total: 0, page: 1, size: 20, items: [], facets: {}, repositoryTotal: null, facetsAvailable: true } satisfies RecordSearchResult;
const detail = { id: "a" } as RecordDetail;

const makeSource = () => {
  const search = vi.fn(async () => result);
  const get = vi.fn(async (id: string): Promise<RecordDetail | null> => (id === "a" ? detail : null));
  const source: RecordRepository = { capabilities: MDPOSIT_CAPABILITIES, search, get };
  return { source, search, get };
};

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("withCache", () => {
  it("serves a second identical search without calling the source, and equal queries share a key", async () => {
    const { source, search } = makeSource();
    const repository = withCache(source, { searchMs: 60_000, getMs: 60_000 });
    await repository.search(query({ q: " lyso ", facets: { software: ["B", "A"], solvent: [] } }));
    await repository.search(query({ q: "lyso", facets: { software: ["A", "B"] } }));
    expect(search).toHaveBeenCalledTimes(1);
    await repository.search(query({ q: "lyso", page: 2 }));
    expect(search).toHaveBeenCalledTimes(2);
  });

  it("expires entries after the TTL", async () => {
    const { source, search } = makeSource();
    const repository = withCache(source, { searchMs: 1_000, getMs: 1_000 });
    await repository.search(query());
    vi.advanceTimersByTime(999);
    await repository.search(query());
    expect(search).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2);
    await repository.search(query());
    expect(search).toHaveBeenCalledTimes(2);
  });

  it("does not cache errors or unknown ids", async () => {
    const { source, search, get } = makeSource();
    search.mockRejectedValueOnce(new Error("boom"));
    const repository = withCache(source, { searchMs: 60_000, getMs: 60_000 });
    await expect(repository.search(query())).rejects.toThrow("boom");
    await repository.search(query());
    expect(search).toHaveBeenCalledTimes(2);
    expect(await repository.get("missing")).toBeNull();
    expect(await repository.get("missing")).toBeNull();
    expect(get).toHaveBeenCalledTimes(2);
    await repository.get("a");
    await repository.get("a");
    expect(get).toHaveBeenCalledTimes(3);
  });

  it("keeps the capabilities of the source", () => {
    expect(withCache(makeSource().source, { searchMs: 1, getMs: 1 }).capabilities).toBe(MDPOSIT_CAPABILITIES);
  });

  it("builds the key from the normalized query", () => {
    expect(searchKey(query({ facets: { solvent: ["x"], software: ["b", "a"] } }))).toBe(searchKey(query({ facets: { software: ["a", "b"], solvent: ["x"] } })));
  });
});
