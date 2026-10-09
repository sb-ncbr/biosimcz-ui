import { beforeEach, describe, expect, it } from "vitest";
import { publishedDepositions } from "@/mocks/fixtures/myDepositions";
import { server } from "@/test/msw";
import { seedMyDepositionsDemo } from "./myDepositions";
import { recordsHandlers } from "./records";
import { createMockState, type MockState } from "./state";

const BASE = "http://mock.test";
let state: MockState;

type Body = Record<string, unknown>;

const get = async (path: string): Promise<{ status: number; body: Body }> => {
  const response = await fetch(`${BASE}${path}`);
  return { status: response.status, body: (await response.json()) as Body };
};

const idsOf = (body: Body): string[] => (body["items"] as { id: string }[]).map((record) => record.id);

beforeEach(() => {
  state = createMockState();
  seedMyDepositionsDemo(state);
  server.use(...recordsHandlers(state));
});

describe("E-R1 mock", () => {
  it("is anonymous and lists only published rows, never drafts", async () => {
    const { status, body } = await get("/api/records?size=100");
    expect(status).toBe(200);
    expect(body["total"]).toBe(publishedDepositions.length);
    expect(idsOf(body)).not.toContain("draft-figma");
  });

  it("searches full text", async () => {
    const { body } = await get("/api/records?q=membrane");
    expect(idsOf(body)).toContain("pub-popc");
    expect(body["total"]).toBeLessThan(publishedDepositions.length);
  });

  it("sorts by publication date and title", async () => {
    const asc = await get("/api/records?sort=published_asc&size=100");
    const dates = (asc.body["items"] as { published_at: string }[]).map((record) => record.published_at);
    expect(dates).toEqual([...dates].sort());
    const byTitle = await get("/api/records?sort=title_asc&size=100");
    const titles = (byTitle.body["items"] as { title: string }[]).map((record) => record.title);
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
  });

  it("pages the results", async () => {
    const { body } = await get("/api/records?size=2&page=2");
    expect(body["items"]).toHaveLength(2);
    expect(body["page"]).toBe(2);
    expect(body["total"]).toBe(publishedDepositions.length);
  });

  it("filters by a repeatable facet and counts each facet without its own filter", async () => {
    const { body } = await get("/api/records?access=open&access=restricted&engine=GROMACS");
    const items = body["items"] as { access: string }[];
    expect(items.length).toBeGreaterThan(0);
    for (const record of items) expect(["open", "restricted"]).toContain(record.access);
    const engines = (body["facets"] as Record<string, { key: string }[]>)["engine"]?.map((bucket) => bucket.key);
    // engine ignores its own filter, so AMBER is still offered.
    expect(engines).toContain("AMBER");
  });
});

describe("E-R2 mock", () => {
  it("returns files only for open records", async () => {
    const open = await get("/api/records/pub-popc");
    expect(open.body["files"]).toHaveLength(2);
    expect(open.body["communities"]).toEqual([{ id: "community-2", slug: "membrane-lab", title: "Membrane Lab" }]);
    const embargoed = await get("/api/records/pub-villin");
    expect(embargoed.body).not.toHaveProperty("files");
  });

  it("answers 404 for unknown ids and drafts", async () => {
    expect((await get("/api/records/nope")).status).toBe(404);
    expect((await get("/api/records/draft-figma")).status).toBe(404);
  });

  it("serves a draft once it is published", async () => {
    const draft = state.drafts.get("draft-figma");
    if (draft) draft.status = "published";
    expect((await get("/api/records/draft-figma")).status).toBe(200);
  });
});
