import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import type { RecordSearchQuery } from "@/entities/record";
import { seedMyDepositionsDemo } from "@/mocks/handlers/myDepositions";
import { recordsHandlers } from "@/mocks/handlers/records";
import { createMockState } from "@/mocks/handlers/state";
import { server } from "@/test/msw";
import { setTestEnv } from "@/test/serverEnv";
import { mdrepoRecordRepository, toWireQuery } from "./mdrepoRecordRepository";

const defaultRecordQuery = (): RecordSearchQuery => ({ q: "", sort: "bestmatch", page: 1, size: 20, facets: {} });

beforeEach(() => {
  setTestEnv();
  const state = createMockState();
  seedMyDepositionsDemo(state);
  server.use(...recordsHandlers(state));
});

describe("toWireQuery", () => {
  it("sends only what the user chose", () => {
    expect(toWireQuery(defaultRecordQuery())).toEqual({ page: 1, size: 20 });
    const base = defaultRecordQuery();
    const chosen = { ...base, q: "lipid", sort: "title" as const, page: 2, size: 10, facets: { access: ["open", "embargoed"], software: ["GROMACS"] } };
    expect(toWireQuery(chosen)).toEqual({ page: 2, size: 10, q: "lipid", sort: "title_asc", access: ["open", "embargoed"], engine: ["GROMACS"] });
    expect(toWireQuery({ ...base, sort: "newest" }).sort).toBe("published_desc");
    expect(toWireQuery({ ...base, sort: "oldest" }).sort).toBe("published_asc");
  });
});

describe("mdrepoRecordRepository", () => {
  it("maps a search to domain records and facets", async () => {
    const result = await mdrepoRecordRepository.search({ ...defaultRecordQuery(), q: "membrane" });
    expect(result.items.map((record) => record.id)).toContain("pub-popc");
    const popc = result.items.find((record) => record.id === "pub-popc");
    expect(popc?.authors).toEqual(["Nováková J.", "Kovář P."]);
    expect(popc?.communities).toEqual([{ id: "community-2", label: "Membrane Lab" }]);
    expect(result.facets.software?.length).toBeGreaterThan(0);
    expect(result.repositoryTotal).toBeNull();
  });

  it("sends repeatable facets as repeated parameters, without auth headers", async () => {
    let seen: Request | undefined;
    server.use(
      http.get("*/api/records", ({ request }) => {
        seen = request;
        return HttpResponse.json({ total: 0, page: 1, size: 20, items: [], facets: {} });
      }),
    );
    const base = defaultRecordQuery();
    await mdrepoRecordRepository.search({ ...base, facets: { keyword: ["a", "b"] } });
    expect(seen).toBeDefined();
    expect(new URL(seen?.url ?? "").searchParams.getAll("keyword")).toEqual(["a", "b"]);
    expect(seen?.headers.get("authorization")).toBeNull();
    expect(seen?.headers.get("cookie")).toBeNull();
  });

  it("returns a record, and null for a 404", async () => {
    expect((await mdrepoRecordRepository.get("pub-popc"))?.files).toHaveLength(2);
    expect(await mdrepoRecordRepository.get("missing")).toBeNull();
  });

  it("throws an ApiError for a 5xx and for a schema mismatch", async () => {
    server.use(http.get("*/api/records", () => HttpResponse.json({ message: "boom" }, { status: 500 })));
    await expect(mdrepoRecordRepository.search(defaultRecordQuery())).rejects.toMatchObject({ kind: "http" });
    server.use(http.get("*/api/records", () => HttpResponse.json({ nope: true })));
    await expect(mdrepoRecordRepository.search(defaultRecordQuery())).rejects.toMatchObject({ kind: "schema" });
  });
});
