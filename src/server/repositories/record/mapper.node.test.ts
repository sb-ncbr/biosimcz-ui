import { describe, expect, it } from "vitest";
import { fromDetailResponse, fromSearchResponse } from "./mapper";

type SearchWire = Parameters<typeof fromSearchResponse>[0];
type DetailWire = Parameters<typeof fromDetailResponse>[0];

const item = (extra: Record<string, unknown> = {}) => ({
  id: "r1",
  title: "POPC membrane",
  published_at: "2026-02-12T09:00:00Z",
  updated_at: "2026-02-12T09:00:00Z",
  doi: "10.1234/mdrepo.1",
  version: 2,
  access: "open",
  community_ids: ["c1"],
  metadata: {
    study: {
      description: "A membrane.",
      keywords: ["membrane"],
      license: "cc-by-4.0",
      authors: [
        { kind: "person", given_name: "Jana", family_name: "Novakova", orcid: "0000-0002-1825-0097", affiliations: [{ name: "Masaryk University" }] },
        { kind: "organization", name: "CERIT-SC" },
      ],
    },
    system: { engine: { name: "GROMACS" } },
  },
  ...extra,
});

const search = (items: unknown[], facets: Record<string, unknown> = {}) =>
  ({ total: items.length, page: 1, size: 20, items, facets }) as SearchWire;
const detail = (extra: Record<string, unknown> = {}) => ({ ...item(), ...extra }) as DetailWire;

describe("fromSearchResponse", () => {
  it("maps a full item, including bylines and the community label from the facets", () => {
    const result = fromSearchResponse(search([item()], { community: [{ key: "c1", label: "BioSim CZ", count: 1 }] }));
    expect(result.items[0]).toMatchObject({
      id: "r1",
      title: "POPC membrane",
      authors: ["Novakova J.", "CERIT-SC"],
      description: "A membrane.",
      doi: "10.1234/mdrepo.1",
      version: 2,
      access: "open",
      license: "cc-by-4.0",
      communities: [{ id: "c1", label: "BioSim CZ" }],
      keywords: ["membrane"],
    });
  });

  it("copes with missing metadata, a missing DOI and an unknown access value", () => {
    const [record] = fromSearchResponse(search([{ id: "r2", title: null, access: "secret", community_ids: [], doi: null }])).items;
    expect(record).toMatchObject({ title: null, authors: [], description: null, doi: null, version: null, access: null, license: null, communities: [] });
  });

  it("falls back to the metadata title and labels a community by its id when no label is known", () => {
    const [record] = fromSearchResponse(search([item({ title: null, metadata: { study: { title: "From metadata" } } })])).items;
    expect(record?.title).toBe("From metadata");
    expect(record?.communities).toEqual([{ id: "c1", label: "c1" }]);
  });

  it("reads facet buckets and ignores malformed ones", () => {
    const { facets } = fromSearchResponse(search([], { access: [{ key: "open", count: 3 }, { key: 5 }, "x"], engine: "nope" }));
    expect(facets.access).toEqual([{ key: "open", label: "open", count: 3 }]);
    expect(facets.software).toEqual([]);
    expect(facets.keyword).toEqual([]);
  });
});

describe("fromDetailResponse", () => {
  it("maps full author names, ORCID, affiliations, engine and files", () => {
    const record = fromDetailResponse(
      detail({ files: [{ key: "topol.top", size: 20480, mimetype: "text/plain" }], communities: [{ id: "c1", slug: "biosim", title: "BioSim CZ" }] }),
    );
    expect(record.authors).toEqual([
      { name: "Jana Novakova", orcid: "0000-0002-1825-0097", affiliations: ["Masaryk University"] },
      { name: "CERIT-SC", orcid: null, affiliations: [] },
    ]);
    expect(record.engine).toBe("GROMACS");
    expect(record.communities).toEqual([{ id: "c1", label: "BioSim CZ" }]);
    expect(record.files).toEqual([{ key: "topol.top", size: 20480, mimetype: "text/plain" }]);
  });

  it("tells absent files (null) from an empty list", () => {
    expect(fromDetailResponse(detail()).files).toBeNull();
    expect(fromDetailResponse(detail({ files: [] })).files).toEqual([]);
  });

  it("keeps the embargo date of an embargoed record", () => {
    const record = fromDetailResponse(detail({ access: "embargoed", metadata: { study: { embargo: { until: "2027-03-01" } } } }));
    expect(record).toMatchObject({ access: "embargoed", embargoUntil: "2027-03-01", files: null });
  });
});
