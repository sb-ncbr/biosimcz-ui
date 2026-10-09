import { describe, expect, it } from "vitest";
import { completeDraft } from "@/test/depositionFixtures";
import { toExperimentMetadata } from "./mapper";
import { authorLabel, fromListMineResponse } from "./listMapper";

const base = {
  created_at: "2026-09-01T08:00:00Z",
  updated_at: "2026-09-29T08:00:00Z",
  published_at: null,
  doi: null,
  access: null,
  community_ids: [],
  has_preview: false,
};

const response = (items: unknown[], extra: Record<string, unknown> = {}) =>
  ({ total: items.length, page: 1, size: 20, counts_by_status: {}, facets: {}, items, ...extra }) as Parameters<typeof fromListMineResponse>[0];

describe("fromListMineResponse", () => {
  it("shows an empty draft as unnamed with zero progress", () => {
    const [item] = fromListMineResponse(response([{ ...base, id: "d1", status: "draft", title: null, metadata: {} }])).items;
    expect(item).toMatchObject({ kind: "draft", title: null, authors: [], structure: null, license: null });
    expect(item?.progress?.completion).toBe(0);
    expect(item?.progress?.steps.map((s) => s.status)).toEqual(["todo", "todo", "todo"]);
    expect(item?.progress?.attentionStep).toBe("study");
  });

  it("computes progress with computeCompleteness, so a complete draft has nothing left", () => {
    const metadata = toExperimentMetadata(completeDraft());
    const [item] = fromListMineResponse(response([{ ...base, id: "d2", status: "draft", title: "Lysozyme in water", metadata }])).items;
    expect(item?.progress).toMatchObject({ requiredLeft: 0, completion: 100, attentionStep: null });
    expect(item?.authors).toEqual(["Novakova J."]);
    expect(item?.structure).toEqual({ source: "pdb", id: "1AKI" });
    expect(item?.license).toBe("cc-by-4.0");
  });

  it("maps a published item without metadata and keeps version only when present", () => {
    const { items } = fromListMineResponse(
      response([
        { ...base, id: "p1", status: "published", title: "T", doi: "10.1/x", published_at: "2026-02-12T00:00:00Z", access: "open", version: 2 },
        { ...base, id: "p2", status: "in_review", title: "U" },
      ]),
    );
    expect(items[0]).toMatchObject({ kind: "published", progress: null, doi: "10.1/x", version: 2, access: "open" });
    expect(items[1]).toMatchObject({ kind: "published", version: null, authors: [] });
  });

  it("reads counts and facets defensively", () => {
    const list = fromListMineResponse(
      response([], {
        counts_by_status: { draft: 3, published: 2 },
        facets: {
          created: { buckets: [{ key: "2026-09", count: 3 }, { key: "bad", count: 1 }] },
          access: [{ key: "open", count: 3 }, { key: 7 }],
          community: [{ key: "c1", label: "CEITEC", count: 3 }],
        },
      }),
    );
    expect(list.counts).toEqual({ all: 5, draft: 3, published: 2 });
    expect(list.facets.created).toEqual([{ key: "2026-09", count: 3 }]);
    expect(list.facets.options.access).toEqual([{ key: "open", label: "open", count: 3 }]);
    expect(list.facets.options.community[0]?.label).toBe("CEITEC");
    expect(list.facets.options.keyword).toEqual([]);
  });
});

describe("authorLabel", () => {
  it("abbreviates persons and keeps organisations whole", () => {
    expect(authorLabel({ kind: "person", givenName: "Jana", familyName: "Novakova", affiliations: [] })).toBe("Novakova J.");
    expect(authorLabel({ kind: "organization", name: "Brno Consortium", affiliations: [] })).toBe("Brno Consortium");
    expect(authorLabel({ kind: "person", affiliations: [] })).toBeNull();
  });
});
