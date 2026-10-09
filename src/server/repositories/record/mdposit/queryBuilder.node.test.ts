import { describe, expect, it } from "vitest";
import { RECORD_PAGE_SIZE, type RecordSearchQuery } from "@/entities/record";
import { buildFilter, buildOptionsRequest, buildProjectsRequest, escapeRegExp, FACET_FIELDS, MAX_FILTER_CHARS } from "./queryBuilder";

const base = (overrides: Partial<RecordSearchQuery> = {}): RecordSearchQuery => ({ q: "", sort: "bestmatch", page: 1, size: RECORD_PAGE_SIZE, facets: {}, ...overrides });

const filterOf = (facets: RecordSearchQuery["facets"]): unknown => buildFilter(facets).filter;

// Every operator that may appear anywhere in a built filter.
const ALLOWED_OPERATORS = new Set(["$and", "$in", "$gte", "$regex", "$options"]);

const keysDeep = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(keysDeep);
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) => [key, ...keysDeep(child)]);
};

const allowedFields = new Set(Object.values(FACET_FIELDS).map((spec) => spec?.field));

// Every value that ends up inside an operator: primitives only (an inert string is fine, an object would be an operator).
const valuesOfOperators = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value.flatMap(valuesOfOperators);
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) => (key === "$in" ? (child as unknown[]) : key === "$regex" || key === "$gte" || key === "$options" ? [child] : valuesOfOperators(child)));
};

// The injection invariant: whatever goes in, only allowlisted fields and operators come out, operands are primitives and no
// string operand starts with "$".
const expectSafe = (filter: unknown): void => {
  for (const key of keysDeep(filter)) {
    expect(key.startsWith("$") ? ALLOWED_OPERATORS.has(key) : allowedFields.has(key), `unexpected key ${key}`).toBe(true);
  }
  for (const operand of valuesOfOperators(filter)) {
    expect(["string", "number"]).toContain(typeof operand);
    if (typeof operand === "string") expect(operand.startsWith("$")).toBe(false);
  }
};

describe("buildFilter: one case per facet", () => {
  it.each([
    ["software", "metadata.PROGRAM"],
    ["force_field", "metadata.FF"],
    ["solvent", "metadata.WAT"],
    ["method", "metadata.METHOD"],
    ["type", "metadata.TYPE"],
    ["collection", "metadata.COLLECTIONS"],
    ["ensemble", "metadata.ENSEMBLE"],
  ] as const)("%s -> $in on %s", (facet, field) => {
    expect(filterOf({ [facet]: ["A", "B"] })).toEqual({ [field]: { $in: ["A", "B"] } });
  });

  it("temp and timestep -> numeric $in", () => {
    expect(filterOf({ temp: ["300", "310.15"] })).toEqual({ "metadata.TEMP": { $in: [300, 310.15] } });
    expect(filterOf({ timestep: ["2"] })).toEqual({ "metadata.TIMESTEP": { $in: [2] } });
  });

  it("min_atoms -> $gte on the real field SYSTATS", () => {
    expect(filterOf({ min_atoms: ["5000"] })).toEqual({ "metadata.SYSTATS": { $gte: 5000 } });
  });

  it("creator and affiliation -> escaped, case-insensitive $regex, one clause per value", () => {
    expect(filterOf({ creator: ["Orozco"] })).toEqual({ "metadata.AUTHORS": { $regex: "Orozco", $options: "i" } });
    expect(filterOf({ affiliation: ["IRB", "Barcelona"] })).toEqual({
      $and: [
        { "metadata.GROUPS": { $regex: "IRB", $options: "i" } },
        { "metadata.GROUPS": { $regex: "Barcelona", $options: "i" } },
      ],
    });
  });

  it("several facets are combined with $and, none gives no filter", () => {
    expect(filterOf({ software: ["GROMACS"], min_atoms: ["10"] })).toEqual({
      $and: [{ "metadata.PROGRAM": { $in: ["GROMACS"] } }, { "metadata.SYSTATS": { $gte: 10 } }],
    });
    expect(filterOf({})).toBeUndefined();
    expect(filterOf({ software: [] })).toBeUndefined();
  });

  it("an options filter leaves out its own facet", () => {
    const request = buildOptionsRequest("software", { software: ["GROMACS"], solvent: ["TIP3P"] });
    expect(request).toEqual({ projection: "metadata.PROGRAM", query: JSON.stringify({ "metadata.WAT": { $in: ["TIP3P"] } }) });
    expect(buildOptionsRequest("software", { software: ["GROMACS"] })).toEqual({ projection: "metadata.PROGRAM" });
  });

  it("facets without a field have no options call", () => {
    expect(buildOptionsRequest("access", {})).toBeNull();
    expect(buildOptionsRequest("keyword", { software: ["GROMACS"] })).toBeNull();
  });
});

describe("buildFilter: injection attempts are neutralized", () => {
  it.each(["$where", "$ne", "$gt", "$function", "$expr"])("drops the operator-like value %s", (value) => {
    expect(filterOf({ software: [value, "GROMACS"], creator: [value] })).toEqual({ "metadata.PROGRAM": { $in: ["GROMACS"] } });
  });

  it("never turns user keys into filter keys", () => {
    const hostile = JSON.parse('{"$where":["1"],"metadata.PASSWORD":["x"],"__proto__":["x"],"constructor":["x"],"software":["GROMACS"]}') as RecordSearchQuery["facets"];
    const filter = filterOf(hostile);
    expect(filter).toEqual({ "metadata.PROGRAM": { $in: ["GROMACS"] } });
    expectSafe(filter);
  });

  it('serialises {"$ne":null} and nested objects as inert values or drops them', () => {
    const facets = { software: [{ $ne: null }, { $where: "1" }, ["nested"], null, 7, "ok"], temp: [{ $gt: 0 }], min_atoms: [{ $gte: 1 }] } as unknown as RecordSearchQuery["facets"];
    const filter = filterOf(facets);
    expect(filter).toEqual({ "metadata.PROGRAM": { $in: ["ok"] } });
    expectSafe(filter);
  });

  it("ignores a facet value that is not an array", () => {
    const facets = { software: { $ne: null }, creator: "x" } as unknown as RecordSearchQuery["facets"];
    expect(filterOf(facets)).toBeUndefined();
  });

  it("caps huge arrays per facet", () => {
    const many = Array.from({ length: 5000 }, (_, index) => `value${index}`);
    const filter = filterOf({ software: many, creator: many }) as { $and: { "metadata.PROGRAM"?: { $in: string[] } }[] };
    expect(filter.$and[0]?.["metadata.PROGRAM"]?.$in).toHaveLength(20);
    expect(filter.$and).toHaveLength(1 + 10);
  });

  it("drops over-long values", () => {
    expect(filterOf({ software: ["x".repeat(101)], creator: ["y".repeat(101)] })).toBeUndefined();
    expect(filterOf({ software: ["x".repeat(100)] })).toBeDefined();
  });

  it("caps the total size of the filter and reports what was dropped", () => {
    const unique = (count: number) => Array.from({ length: count }, (_, index) => `${index}`.padEnd(100, "z"));
    const facets = {
      software: unique(20),
      force_field: unique(20),
      solvent: unique(20),
      method: unique(20),
      collection: unique(20),
    };
    const { filter, dropped } = buildFilter(facets);
    expect(JSON.stringify(filter).length).toBeLessThanOrEqual(MAX_FILTER_CHARS);
    expect(dropped).toBeGreaterThan(0);
  });

  it("rejects non-numeric, non-finite and out-of-range numbers", () => {
    expect(filterOf({ temp: ["abc", "NaN", "Infinity", "1e999", "-5", "10001", "0x10", ""] })).toBeUndefined();
    expect(filterOf({ timestep: ["101"] })).toBeUndefined();
    expect(filterOf({ min_atoms: ["1000000001"] })).toBeUndefined();
    expect(filterOf({ min_atoms: ["1.5"] })).toBeUndefined();
    expect(filterOf({ min_atoms: ["-1"] })).toBeUndefined();
    expect(filterOf({ temp: ["10000"] })).toEqual({ "metadata.TEMP": { $in: [10000] } });
  });

  it("escapes every regex metacharacter, so user text matches literally", () => {
    const meta = ".*+?^${}()|[]\\-/";
    const escaped = escapeRegExp(meta);
    // Every metacharacter is preceded by a backslash and the pattern still compiles to the literal text.
    expect(new RegExp(`^${escaped}$`).test(meta)).toBe(true);
    expect(new RegExp(`^${escapeRegExp(".*")}$`).test("abc")).toBe(false);
    const filter = filterOf({ creator: ["(a+)+$", ".*"] }) as { $and: { "metadata.AUTHORS": { $regex: string } }[] };
    expect(filter.$and.map((clause) => clause["metadata.AUTHORS"].$regex)).toEqual(["\\(a\\+\\)\\+\\$", "\\.\\*"]);
  });

  it("never emits an operator outside the allowlist, for a mixed hostile input", () => {
    const hostile = {
      software: ["$where", "{\"$ne\":null}", "GROMACS"],
      creator: ["$regex", "a|b", "(?=x)"],
      temp: ["300", "$gt"],
      min_atoms: ["$gte"],
      affiliation: ["x".repeat(1000)],
    };
    expectSafe(filterOf(hostile));
  });
});

describe("buildProjectsRequest", () => {
  it("sends text, filter, sort, page and limit", () => {
    const { request } = buildProjectsRequest(base({ q: "  lysozyme ", sort: "oldest", page: 3, size: 50, facets: { software: ["GROMACS"] } }));
    expect(request).toEqual({
      search: "lysozyme",
      query: JSON.stringify({ "metadata.PROGRAM": { $in: ["GROMACS"] } }),
      sort: { _id: 1 },
      page: 3,
      limit: 50,
    });
  });

  it("maps sorts: bestmatch without text is newest, with text it sends no sort", () => {
    expect(buildProjectsRequest(base()).request.sort).toEqual({ _id: -1 });
    expect(buildProjectsRequest(base({ q: "x" })).request.sort).toBeUndefined();
    expect(buildProjectsRequest(base({ sort: "newest" })).request.sort).toEqual({ _id: -1 });
    expect(buildProjectsRequest(base({ sort: "oldest" })).request.sort).toEqual({ _id: 1 });
    expect(buildProjectsRequest(base({ sort: "title" })).request.sort).toEqual({ "metadata.NAME": 1 });
  });

  it("sends no query for no filters and no search for blank text", () => {
    const { request } = buildProjectsRequest(base({ q: "   " }));
    expect(request).not.toHaveProperty("query");
    expect(request).not.toHaveProperty("search");
  });

  it("caps the search text at 200 characters", () => {
    expect(buildProjectsRequest(base({ q: "a".repeat(500) })).request.search).toHaveLength(200);
  });

  it("clamps limit to 1..100 and page to 1..10000, falling back for NaN", () => {
    expect(buildProjectsRequest(base({ size: 5000 })).request.limit).toBe(100);
    expect(buildProjectsRequest(base({ size: 0 })).request.limit).toBe(1);
    expect(buildProjectsRequest(base({ size: -3 })).request.limit).toBe(1);
    expect(buildProjectsRequest(base({ size: Number.NaN })).request.limit).toBe(20);
    expect(buildProjectsRequest(base({ page: 99_999 })).request.page).toBe(10_000);
    expect(buildProjectsRequest(base({ page: 0 })).request.page).toBe(1);
    expect(buildProjectsRequest(base({ page: Number.NaN })).request.page).toBe(1);
  });
});
