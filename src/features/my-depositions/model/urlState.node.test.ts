import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  bucketRange,
  clearFilters,
  defaultQuery,
  parseDateInput,
  parseListQuery,
  serializeListQuery,
  setDateRange,
  setPage,
  setSearch,
  setStatus,
  toggleFacetValue,
} from "./urlState";

describe("parseListQuery", () => {
  it("returns the defaults for an empty URL and serializes them to nothing", () => {
    const query = parseListQuery({});
    expect(query).toEqual(defaultQuery());
    expect(serializeListQuery(query)).toBe("");
  });

  it("reads status, search, sort, page and repeated facets", () => {
    const query = parseListQuery(new URLSearchParams("status=draft&q=lysozyme&sort=title_asc&page=3&community=c1&community=c2&engine=GROMACS"));
    expect(query).toMatchObject({ status: "draft", q: "lysozyme", sort: "title_asc", page: 3 });
    expect(query.facets.community).toEqual(["c1", "c2"]);
    expect(query.facets.engine).toEqual(["GROMACS"]);
    expect(query.facets.access).toEqual([]);
  });

  it("accepts Next-style searchParams with array values", () => {
    expect(parseListQuery({ keyword: ["a", "b"], status: "published" }).facets.keyword).toEqual(["a", "b"]);
  });

  it("falls back to defaults for invalid values instead of throwing", () => {
    const query = parseListQuery({ status: "deleted", sort: "random", page: "-4", from: "2025-13-45", by: "week" });
    expect(query).toEqual(defaultQuery());
    expect(parseListQuery({ page: "abc" }).page).toBe(1);
    expect(parseListQuery({ page: "99999999" }).page).toBe(10_000);
  });

  it("trims, dedupes and caps facet values and the search text", () => {
    const query = parseListQuery({ author: [" Novakova J. ", "Novakova J.", "", "x".repeat(101)], q: `  ${"y".repeat(300)} ` });
    expect(query.facets.author).toEqual(["Novakova J."]);
    expect(query.q).toHaveLength(200);
    const many = Array.from({ length: 30 }, (_, index) => `k${index}`);
    expect(parseListQuery({ keyword: many }).facets.keyword).toHaveLength(20);
  });

  it("drops a reversed date range's upper bound", () => {
    expect(parseListQuery({ from: "2026-05-01", to: "2026-01-01" })).toMatchObject({ createdFrom: "2026-05-01", createdTo: null });
  });

  it("round-trips through serialize", () => {
    const original = parseListQuery(
      new URLSearchParams("status=published&q=a+b&sort=created_desc&page=2&by=month&from=2025-01-01&to=2025-12-31&access=open&access=embargoed&keyword=lysozyme"),
    );
    const again = parseListQuery(new URLSearchParams(serializeListQuery(original)));
    expect(again).toEqual(original);
  });

  it("encodes special characters", () => {
    const query = setSearch(defaultQuery(), "a&b=c#d");
    expect(serializeListQuery(query)).toBe("?q=a%26b%3Dc%23d");
    expect(parseListQuery(new URLSearchParams(serializeListQuery(query))).q).toBe("a&b=c#d");
  });
});

describe("transitions", () => {
  it("returns to page 1 when the result set changes, but not for setPage", () => {
    const onPage3 = setPage(defaultQuery(), 3);
    expect(onPage3.page).toBe(3);
    expect(setStatus(onPage3, "draft").page).toBe(1);
    expect(setSearch(onPage3, "x").page).toBe(1);
    expect(toggleFacetValue(onPage3, "access", "open").page).toBe(1);
    expect(setDateRange(onPage3, "2025-01-01", null).page).toBe(1);
  });

  it("toggles a facet value on and off", () => {
    const on = toggleFacetValue(defaultQuery(), "community", "c1");
    expect(on.facets.community).toEqual(["c1"]);
    expect(toggleFacetValue(on, "community", "c1").facets.community).toEqual([]);
  });

  it("clears filters and dates but keeps tab, search and sort", () => {
    const query = { ...setDateRange(toggleFacetValue(setStatus(setSearch(defaultQuery(), "lys"), "draft"), "engine", "AMBER"), "2025-01-01", "2025-12-31"), sort: "title_asc" as const };
    const cleared = clearFilters(query);
    expect(cleared).toMatchObject({ status: "draft", q: "lys", sort: "title_asc", createdFrom: null, createdTo: null });
    expect(activeFilterCount(cleared)).toBe(0);
  });

  it("counts every facet value and the date range once", () => {
    let query = toggleFacetValue(defaultQuery(), "community", "c1");
    query = toggleFacetValue(query, "keyword", "a");
    query = toggleFacetValue(query, "keyword", "b");
    expect(activeFilterCount(query)).toBe(3);
    expect(activeFilterCount(setDateRange(query, "2025-01-01", "2025-12-31"))).toBe(4);
  });
});

describe("date input", () => {
  it("expands a year or month to the start or end of the period", () => {
    expect(parseDateInput("2025", "from")).toBe("2025-01-01");
    expect(parseDateInput("2025", "to")).toBe("2025-12-31");
    expect(parseDateInput("2024-02", "to")).toBe("2024-02-29");
    expect(parseDateInput("2025-03-09", "from")).toBe("2025-03-09");
  });

  it("rejects text that is not a date", () => {
    for (const text of ["", "abc", "2025-13", "2025-02-30", "25", "2025/03/09"]) expect(parseDateInput(text, "from")).toBeNull();
  });

  it("turns histogram bucket keys into ranges", () => {
    expect(bucketRange("2026")).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(bucketRange("2026-09")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(bucketRange("nope")).toBeNull();
  });
});
