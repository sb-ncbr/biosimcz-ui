import { beforeEach, describe, expect, it } from "vitest";
import { server } from "@/test/msw";
import { createMockBackend } from "./index";

const BASE = "http://mdposit.test/api/rest/v1";

type Body = { projects: { accession: string; metadata: { NAME: string } }[]; filteredCount: number; totalMdsCount: null } & Record<string, unknown>;

const get = async (path: string, params: Record<string, string> = {}): Promise<{ status: number; body: Body }> => {
  const url = new URL(`${BASE}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url);
  return { status: response.status, body: (await response.json()) as Body };
};

const names = (body: Body): string[] => body.projects.map((project) => project.metadata.NAME);

beforeEach(() => {
  server.use(...createMockBackend().handlers);
});

describe("MDposit mock /projects", () => {
  it("returns the live envelope and pages with the default limit 10", async () => {
    const { body } = await get("/projects");
    expect(body.filteredCount).toBe(25);
    expect(body.totalMdsCount).toBeNull();
    expect(body.projects).toHaveLength(10);
    expect((await get("/projects", { page: "3" })).body.projects).toHaveLength(5);
  });

  it("clamps limit to 100", async () => {
    expect((await get("/projects", { limit: "500" })).body.projects).toHaveLength(25);
  });

  it("searches text over name, description, authors and groups", async () => {
    expect(names((await get("/projects", { search: "lysozyme" })).body)).toEqual(["Hen egg-white lysozyme in water, 100 ns"]);
    expect((await get("/projects", { search: "Membrane Lab" })).body.filteredCount).toBeGreaterThan(1);
  });

  it("applies each operator of the builder grammar and intersects with search", async () => {
    const q = (filter: unknown, extra: Record<string, string> = {}) => get("/projects", { query: JSON.stringify(filter), ...extra });
    expect((await q({ "metadata.PROGRAM": { $in: ["GROMACS"] } })).body.filteredCount).toBeGreaterThan(3);
    expect((await q({ "metadata.AUTHORS": { $regex: "svobodova", $options: "i" } })).body.filteredCount).toBeGreaterThan(0);
    expect((await q({ "metadata.SYSTATS": { $gte: 200000 } })).body.filteredCount).toBe(2);
    expect((await q({ $and: [{ "metadata.TEMP": { $in: [310] } }, { "metadata.PROGRAM": { $in: ["GROMACS"] } }] })).body.filteredCount).toBeGreaterThan(0);
    const both = await q({ "metadata.PROGRAM": { $in: ["GROMACS"] } }, { search: "membrane" });
    expect(names(both.body)).toContain("POPC membrane with cholesterol, 1 µs");
    expect(names(both.body)).not.toContain("DPPC bilayer phase transition");
  });

  it("answers 400 for an operator outside the grammar and for invalid JSON", async () => {
    expect((await get("/projects", { query: '{"$where":"1"}' })).status).toBe(400);
    expect((await get("/projects", { query: '{"metadata.PROGRAM":{"$ne":null}}' })).status).toBe(400);
    expect((await get("/projects", { query: "{nope" })).status).toBe(400);
  });

  it("sorts by _id and by name in both directions", async () => {
    expect((await get("/projects", { limit: "1", sort: '{"_id":1}' })).body.projects[0]?.accession).toBe("MD-A00001");
    expect((await get("/projects", { limit: "1", sort: '{"_id":-1}' })).body.projects[0]?.accession).toBe("MD-A00025");
    const asc = names((await get("/projects", { limit: "100", sort: '{"metadata.NAME":1}' })).body);
    expect(asc).toEqual([...asc].sort((a, b) => a.localeCompare(b)));
    expect((await get("/projects", { sort: '{"other":1}' })).status).toBe(400);
  });
});

describe("MDposit mock /projects/options and /summary", () => {
  it("needs a projection, one field per call, and counts values with a null bucket", async () => {
    expect((await get("/projects/options")).status).toBe(400);
    const { body } = await get("/projects/options", { projection: "metadata.PROGRAM" });
    expect(Object.keys(body)).toEqual(["metadata.PROGRAM"]);
    const counts = body["metadata.PROGRAM"] as Record<string, number>;
    expect(counts["GROMACS"]).toBeGreaterThan(3);
    expect(counts["null"]).toBe(1);
  });

  it("counts array fields per element and honours query", async () => {
    const all = (await get("/projects/options", { projection: "metadata.FF" })).body["metadata.FF"] as Record<string, number>;
    expect(all["Amber ff14SB"]).toBeGreaterThan(1);
    const narrowed = (await get("/projects/options", { projection: "metadata.PROGRAM", query: '{"metadata.WAT":{"$in":["OPC"]}}' })).body[
      "metadata.PROGRAM"
    ] as Record<string, number>;
    expect(Object.values(narrowed).reduce((sum, count) => sum + count, 0)).toBe(4);
  });

  it("reports the repository total", async () => {
    expect((await get("/projects/summary")).body["projectsCount"]).toBe(25);
  });
});

describe("MDposit mock /projects/:id", () => {
  it("keeps the ids older tests rely on, and 404s unknown ones", async () => {
    expect(((await get("/projects/MD-A00005")).body["metadata"] as { NAME: string }).NAME).toBe("POPC membrane with cholesterol, 1 µs");
    expect((await get("/projects/MD-A00001.2")).body["accession"]).toBe("MD-A00001");
    expect((await get("/projects/MD-A99999")).status).toBe(404);
  });
});

const raw = async (path: string, params: Record<string, string> = {}): Promise<Response> => {
  const url = new URL(`${BASE}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return fetch(url);
};

describe("MDposit mock replicas and analyses", () => {
  it("serves the captured replica for MD-A007L3.n with live-style replica names", async () => {
    const { status, body } = await get("/projects/MD-A007L3.2");
    expect(status).toBe(200);
    expect(body["accession"]).toBe("MD-A007L3");
    expect(body["mds"]).toEqual(["replica_1", "replica_2", "replica_3", "replica_4"]);
    expect(body["mdIndex"]).toBe(1);
    expect((await get("/projects/MD-A007L3.9")).status).toBe(404);
  });

  it("selects a mock record replica by index and keeps names with spaces", async () => {
    const { body } = await get("/projects/MD-A00001.2");
    expect(body["mdIndex"]).toBe(1);
    expect(body["mds"]).toEqual(["replica 1"]);
    expect((await get("/projects/MD-A00001.2")).status).toBe(200);
    expect((await get("/projects/MD-A00001.0")).status).toBe(404);
  });

  it("lists the captured analyses", async () => {
    const response = await raw("/projects/MD-A007L3.1/analyses");
    const names = (await response.json()) as string[];
    expect(names).toContain("interactions");
    expect(names).toHaveLength(21);
    expect((await raw("/projects/MD-A99999/analyses")).status).toBe(404);
  });

  it("returns options lists for base names and data for numbered names and interactions", async () => {
    for (const base of ["clusters", "dist-perres", "energies", "hbonds", "rmsd-pairwise"]) {
      const options = (await (await raw(`/projects/MD-A007L3.1/analyses/${base}`)).json()) as { name: string; analysis: string }[];
      expect(options[0]?.analysis).toBe(`${base}-00`);
    }
    const interactions = (await (await raw("/projects/MD-A007L3.1/analyses/interactions")).json()) as unknown[];
    expect(interactions).toHaveLength(1);
    const rgyr = (await (await raw("/projects/MD-A007L3.1/analyses/rgyr")).json()) as { y: unknown };
    expect(rgyr.y).toBeDefined();
    expect((await raw("/projects/MD-A007L3.1/analyses/clusters-00")).status).toBe(200);
  });

  it("404s analyses that were not captured", async () => {
    for (const name of ["dist-perres-mean", "no-such-analysis"]) {
      expect((await raw(`/projects/MD-A007L3.1/analyses/${name}`)).status).toBe(404);
    }
  });

  it("answers the structure with or without a selection", async () => {
    expect((await raw("/projects/MD-A007L3.1/structure")).status).toBe(200);
    expect((await (await raw("/projects/MD-A007L3.1/structure", { selection: "protein" })).text())).toContain("ATOM");
  });

  it("returns a small trajectory and rejects 0-based frame ranges with the live message", async () => {
    expect((await raw("/projects/MD-A007L3.1/trajectory", { frames: "1:1000:10" })).status).toBe(200);
    expect((await raw("/projects/MD-A007L3.1/trajectory", { frames: "1-10" })).status).toBe(200);
    for (const frames of ["0:3:1", "0-3", "1-5,0-2"]) {
      const response = await raw("/projects/MD-A007L3.1/trajectory", { frames });
      expect(response.status).toBe(400);
      expect(await response.json()).toBe("Ranges are 1-based so 0 is not supported");
    }
  });
});
