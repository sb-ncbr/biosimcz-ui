import { describe, expect, it } from "vitest";
import { MDPOSIT_CAPABILITIES, MDREPO_CAPABILITIES, type FacetSpec } from "@/entities/record";
import {
  activeRecordFilterCount,
  clearRecordFilters,
  defaultRecordQuery,
  facetValues,
  hasRecordFilters,
  parseRecordQuery,
  serializeRecordQuery,
  setRecordFacet,
  setRecordPage,
  setRecordSearch,
  setRecordSize,
  setRecordSort,
  toggleRecordFacet,
} from "./urlState";

const parse = (input: Record<string, string | string[]> | URLSearchParams, capabilities = MDPOSIT_CAPABILITIES) => parseRecordQuery(input, capabilities);

const spec = (name: string): FacetSpec => {
  const found = [...MDPOSIT_CAPABILITIES.facets, ...MDREPO_CAPABILITIES.facets].find((facet) => facet.name === name);
  if (!found) throw new Error(`no facet ${name}`);
  return found;
};

describe("parseRecordQuery", () => {
  it("returns the defaults for an empty URL and serializes them to nothing", () => {
    const query = parse({});
    expect(query).toEqual(defaultRecordQuery());
    expect(serializeRecordQuery(query)).toBe("");
  });

  it("round-trips q, sort, size, page and facets in a stable order", () => {
    const text = "?q=membrane&sort=title&size=50&page=3&software=GROMACS&software=Amber&force_field=CHARMM36m&temp=300&creator=Orozco&min_atoms=5000";
    const query = parse(new URLSearchParams(text));
    expect(query).toMatchObject({ q: "membrane", sort: "title", size: 50, page: 3 });
    expect(query.facets.software).toEqual(["GROMACS", "Amber"]);
    expect(serializeRecordQuery(query)).toBe("?q=membrane&sort=title&size=50&page=3&software=GROMACS&software=Amber&force_field=CHARMM36m&temp=300&creator=Orozco&min_atoms=5000");
  });

  it("accepts Next-style searchParams with array values", () => {
    expect(parse({ software: ["a", "b"] }).facets.software).toEqual(["a", "b"]);
  });

  it("reads only the facets the source declares and ignores old or unknown keys", () => {
    const old = parse({ access: "open", license: "mit", tag: "x", view_all_versions: "true", thermostat_algo: "v-rescale", sim_type: "Molecular dynamics", __proto__: "x", $where: "1" });
    expect(old.facets).toEqual({});
    const repo = parse({ access: "open", keyword: "lipid", software: "GROMACS", force_field: "x" }, MDREPO_CAPABILITIES);
    expect(repo.facets).toEqual({ access: ["open"], keyword: ["lipid"], software: ["GROMACS"] });
  });

  it("maps legacy sort values and falls back for unsupported ones", () => {
    expect(parse({ sort: "published_desc" }).sort).toBe("newest");
    expect(parse({ sort: "published_asc" }).sort).toBe("oldest");
    expect(parse({ sort: "title_asc" }).sort).toBe("title");
    expect(parse({ sort: "relevance" }).sort).toBe("bestmatch");
    for (const sort of ["random", "updated-desc", "mostviewed", "constructor", "__proto__", ""]) expect(parse({ sort }).sort).toBe("bestmatch");
  });

  it("treats a spaces-only q as empty and bounds the page", () => {
    expect(parse({ q: "   " }).q).toBe("");
    expect(parse({ page: "0" }).page).toBe(1);
    expect(parse({ page: "abc" }).page).toBe(1);
    expect(parse({ page: "-4" }).page).toBe(1);
    expect(parse({ page: "99999999" }).page).toBe(10_000);
  });

  it("allows only the page sizes of the source", () => {
    expect(parse({ size: "10" }).size).toBe(10);
    expect(parse({ size: "7" }).size).toBe(20);
    expect(parse({ size: "100" }).size).toBe(20);
    expect(parse({ size: "x" }).size).toBe(20);
  });

  it("limits the length of q and the facet values per kind", () => {
    expect(parse({ q: "x".repeat(500) }).q).toHaveLength(200);
    const many = Array.from({ length: 30 }, (_, index) => `v${index}`);
    expect(parse({ software: many }).facets.software).toHaveLength(20);
    expect(parse({ creator: many }).facets.creator).toHaveLength(10);
    expect(parse({ software: ["y".repeat(101)] }).facets.software).toBeUndefined();
  });

  it("validates numeric facets and the min-number facet", () => {
    expect(parse({ temp: ["300", "abc", "310.15", "1e3"] }).facets.temp).toEqual(["300", "310.15"]);
    expect(parse({ timestep: "abc" }).facets.timestep).toBeUndefined();
    expect(parse({ min_atoms: ["5000", "9"] }).facets.min_atoms).toEqual(["5000"]);
    for (const bad of ["abc", "-1", "1.5", "99999999999", "", "5000abc"]) expect(parse({ min_atoms: bad }).facets.min_atoms).toBeUndefined();
  });
});

describe("transitions", () => {
  const base = parse({ q: "lipid", sort: "newest", page: "4", software: "GROMACS" });

  it("go back to page 1 when the result set changes", () => {
    expect(setRecordSearch(base, "water").page).toBe(1);
    expect(setRecordSort(base, "title").page).toBe(1);
    expect(setRecordSize(base, 50)).toMatchObject({ size: 50, page: 1 });
    expect(toggleRecordFacet(base, spec("software"), "Amber").page).toBe(1);
    expect(setRecordFacet(base, spec("min_atoms"), ["100"]).page).toBe(1);
  });

  it("keep the page for a plain page change and never go below 1", () => {
    expect(setRecordPage(base, 2).page).toBe(2);
    expect(setRecordPage(base, -3).page).toBe(1);
  });

  it("toggle a facet value on and off, dropping the key when empty", () => {
    const on = toggleRecordFacet(base, spec("software"), "Amber");
    expect(on.facets.software).toEqual(["GROMACS", "Amber"]);
    const off = toggleRecordFacet(toggleRecordFacet(on, spec("software"), "Amber"), spec("software"), "GROMACS");
    expect(off.facets).toEqual({});
    expect(serializeRecordQuery(off)).toBe("?q=lipid&sort=newest");
  });

  it("replaces a text facet and the min-number facet, and rejects an invalid number", () => {
    expect(setRecordFacet(base, spec("creator"), ["Orozco", "Gelpi"]).facets.creator).toEqual(["Orozco", "Gelpi"]);
    expect(facetValues(setRecordFacet(base, spec("min_atoms"), ["1000"]), "min_atoms")).toEqual(["1000"]);
    expect(setRecordFacet(base, spec("min_atoms"), ["abc"]).facets.min_atoms).toBeUndefined();
    expect(setRecordFacet(setRecordFacet(base, spec("min_atoms"), ["1000"]), spec("min_atoms"), []).facets.min_atoms).toBeUndefined();
  });

  it("clears the facets but keeps q, sort and size", () => {
    const cleared = clearRecordFilters({ ...base, size: 50 });
    expect(cleared).toMatchObject({ q: "lipid", sort: "newest", size: 50, page: 1 });
    expect(hasRecordFilters(cleared)).toBe(false);
    expect(activeRecordFilterCount(base)).toBe(1);
  });
});
