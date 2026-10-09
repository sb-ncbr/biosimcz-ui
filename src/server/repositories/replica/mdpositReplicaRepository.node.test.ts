import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import options from "@/mocks/fixtures/mdposit/analysis-options/clusters.json";
import fixture from "@/mocks/fixtures/mdposit/replica/MD-A007L3.1.json";
import { server } from "@/test/msw";
import { setTestEnv } from "@/test/serverEnv";
import { mdpositReplicaRepository } from "./mdpositReplicaRepository";

const ref = { accession: "MD-A007L3", name: "replica_1", number: 1, instanceId: "MD-A007L3.1" };
const BASE = "http://mdposit.test/api/rest/v1/projects/MD-A007L3.1";

beforeEach(() => {
  setTestEnv();
});

describe("mdpositReplicaRepository.get", () => {
  it("maps the replica payload", async () => {
    server.use(http.get(BASE, () => HttpResponse.json(fixture)));
    expect(await mdpositReplicaRepository.get(ref)).toMatchObject({ instanceId: "MD-A007L3.1", frames: 25031 });
  });

  it("404 -> null", async () => {
    server.use(http.get(BASE, () => new HttpResponse(null, { status: 404 })));
    expect(await mdpositReplicaRepository.get(ref)).toBeNull();
  });

  it("a payload without accession -> schema error", async () => {
    server.use(http.get(BASE, () => HttpResponse.json({ metadata: {} })));
    await expect(mdpositReplicaRepository.get(ref)).rejects.toMatchObject({ kind: "schema" });
  });

  it("a 500 is not hidden as null", async () => {
    server.use(http.get(BASE, () => new HttpResponse(null, { status: 500 })));
    await expect(mdpositReplicaRepository.get(ref)).rejects.toMatchObject({ kind: "http" });
  });
});

describe("mdpositReplicaRepository.analysisOptions", () => {
  it("parses the variant list", async () => {
    server.use(http.get(`${BASE}/analyses/clusters`, () => HttpResponse.json(options)));
    expect(await mdpositReplicaRepository.analysisOptions("MD-A007L3.1", "clusters")).toEqual(options);
  });

  it("404 -> null", async () => {
    server.use(http.get(`${BASE}/analyses/clusters`, () => new HttpResponse(null, { status: 404 })));
    expect(await mdpositReplicaRepository.analysisOptions("MD-A007L3.1", "clusters")).toBeNull();
  });

  it("data instead of an options list -> schema error", async () => {
    server.use(http.get(`${BASE}/analyses/interactions`, () => HttpResponse.json([{ name: "x", agent_1: "protein" }])));
    await expect(mdpositReplicaRepository.analysisOptions("MD-A007L3.1", "interactions")).rejects.toMatchObject({ kind: "schema" });
  });
});
