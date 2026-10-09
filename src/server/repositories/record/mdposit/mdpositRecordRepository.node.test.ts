import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { RECORD_PAGE_SIZE, type RecordSearchQuery } from "@/entities/record";
import { createMockBackend } from "@/mocks/handlers";
import { server } from "@/test/msw";
import { setTestEnv } from "@/test/serverEnv";
import { mdpositRecordRepository } from "./mdpositRecordRepository";

const query = (overrides: Partial<RecordSearchQuery> = {}): RecordSearchQuery => ({ q: "", sort: "bestmatch", page: 1, size: RECORD_PAGE_SIZE, facets: {}, ...overrides });

// Requests that reach the mock, as URLs, in order.
let seen: URL[] = [];

beforeEach(() => {
  setTestEnv();
  seen = [];
  server.use(...createMockBackend().handlers);
  server.events.removeAllListeners();
  server.events.on("request:start", ({ request }) => {
    seen.push(new URL(request.url));
  });
});

const listCall = (): URL | undefined => seen.find((url) => url.pathname.endsWith("/projects"));

describe("mdpositRecordRepository.search", () => {
  it("sends exactly the params the query builder produced, anonymously", async () => {
    let headers: Headers | undefined;
    server.events.on("request:start", ({ request }) => {
      if (new URL(request.url).pathname.endsWith("/projects")) headers = request.headers;
    });
    const result = await mdpositRecordRepository.search(query({ q: "membrane", sort: "oldest", page: 1, size: 10, facets: { software: ["GROMACS"] } }));
    const params = listCall()?.searchParams;
    expect(params?.get("search")).toBe("membrane");
    expect(params?.get("query")).toBe(JSON.stringify({ "metadata.PROGRAM": { $in: ["GROMACS"] } }));
    expect(params?.get("sort")).toBe('{"_id":1}');
    expect(params?.get("limit")).toBe("10");
    expect(params?.get("page")).toBe("1");
    expect(headers?.get("authorization")).toBeNull();
    expect(headers?.get("cookie")).toBeNull();
    expect(result.items.map((record) => record.title)).toContain("POPC membrane with cholesterol, 1 µs");
    expect(result.items.every((record) => record.engine?.startsWith("GROMACS"))).toBe(true);
  });

  it("every sort changes the sort param", async () => {
    const sortOf = async (sort: RecordSearchQuery["sort"]) => {
      seen = [];
      await mdpositRecordRepository.search(query({ sort, facets: { ensemble: [sort] } }));
      return listCall()?.searchParams.get("sort");
    };
    expect(await sortOf("newest")).toBe('{"_id":-1}');
    expect(await sortOf("oldest")).toBe('{"_id":1}');
    expect(await sortOf("title")).toBe('{"metadata.NAME":1}');
  });

  it("returns counts, the repository total and the filtered count", async () => {
    const result = await mdpositRecordRepository.search(query({ facets: { software: ["GROMACS"] } }));
    expect(result.repositoryTotal).toBe(25);
    expect(result.facetsAvailable).toBe(true);
    expect(result.total).toBeLessThan(25);
    expect(result.facets.software?.find((option) => option.key === "GROMACS")?.count).toBeGreaterThan(0);
    // The own facet is counted without its own selection: other engines are still offered.
    expect((result.facets.software ?? []).length).toBeGreaterThan(1);
    expect(result.facets.solvent?.every((option) => typeof option.count === "number")).toBe(true);
  });

  it("offers values without counts while text is searched", async () => {
    const result = await mdpositRecordRepository.search(query({ q: "bilayer" }));
    expect(result.facets.software?.length).toBeGreaterThan(0);
    expect(result.facets.software?.every((option) => option.count === null)).toBe(true);
    expect(result.facetsAvailable).toBe(true);
  });

  it("keeps the results when the options calls fail", async () => {
    server.use(http.get("*/api/rest/v1/projects/options", () => HttpResponse.json("boom", { status: 500 })));
    const result = await mdpositRecordRepository.search(query({ facets: { method: ["Steered MD"] } }));
    expect(result.facetsAvailable).toBe(false);
    expect(result.facets).toEqual({});
    expect(result.items.length).toBeGreaterThan(0);
  });

  it("throws an ApiError for a 5xx and for an invalid envelope", async () => {
    server.use(http.get("*/api/rest/v1/projects", () => HttpResponse.json("boom", { status: 500 })));
    await expect(mdpositRecordRepository.search(query())).rejects.toMatchObject({ kind: "http", backend: "mdposit" });
    server.use(http.get("*/api/rest/v1/projects", () => HttpResponse.json({ nope: true })));
    await expect(mdpositRecordRepository.search(query())).rejects.toMatchObject({ kind: "schema" });
  });

  it("skips one invalid project instead of failing the page", async () => {
    server.use(
      http.get("*/api/rest/v1/projects", () =>
        HttpResponse.json({ filteredCount: 2, totalMdsCount: null, projects: [{ metadata: {} }, { accession: "MD-A1", metadata: { NAME: "Fine" } }] }),
      ),
    );
    const result = await mdpositRecordRepository.search(query({ facets: { type: ["ensemble"] } }));
    expect(result.items.map((record) => record.id)).toEqual(["MD-A1"]);
  });

  it("neutralizes hostile facet input before it reaches the wire", async () => {
    const hostile = JSON.parse('{"software":["$where","GROMACS"],"$where":["1"],"creator":["a.*(b+)+$"]}') as RecordSearchQuery["facets"];
    await mdpositRecordRepository.search(query({ q: "x".repeat(900), size: 5000, page: 999_999, facets: hostile }));
    const params = listCall()?.searchParams;
    expect(params?.get("search")).toHaveLength(200);
    expect(params?.get("limit")).toBe("100");
    expect(params?.get("page")).toBe("10000");
    expect(params?.get("query")).not.toContain("$where");
    expect(params?.get("query")).toContain("a\\\\.\\\\*\\\\(b\\\\+\\\\)\\\\+\\\\$");
  });
});

describe("mdpositRecordRepository.get", () => {
  it("maps the project, and a replica id resolves to its project", async () => {
    const record = await mdpositRecordRepository.get("MD-A00005");
    expect(record).toMatchObject({ id: "MD-A00005", title: "POPC membrane with cholesterol, 1 µs" });
    expect(record?.files?.map((file) => file.key)).toContain("topology.top");
    expect((await mdpositRecordRepository.get("MD-A00001.1"))?.id).toBe("MD-A00001");
  });

  it("returns null for a 404, throws for a 5xx", async () => {
    expect(await mdpositRecordRepository.get("MD-A99999")).toBeNull();
    server.use(http.get("*/api/rest/v1/projects/:id", () => HttpResponse.json("boom", { status: 500 })));
    await expect(mdpositRecordRepository.get("MD-A00001")).rejects.toMatchObject({ kind: "http" });
  });
});
