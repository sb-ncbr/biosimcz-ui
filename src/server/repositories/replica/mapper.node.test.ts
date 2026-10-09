import { describe, expect, it } from "vitest";
import fixture from "@/mocks/fixtures/mdposit/replica/MD-A007L3.1.json";
import { replicaProjectSchema } from "../../backends/mdposit/projectSchemas";
import { toReplicaDetail } from "./mapper";

const ref = { accession: "MD-A007L3", name: "replica_1", number: 1, instanceId: "MD-A007L3.1" };
const parse = (value: unknown) => replicaProjectSchema.parse(value);

describe("replicaProjectSchema", () => {
  it("accepts the captured payload (accession without .N, many nulls)", () => {
    const parsed = parse(fixture);
    expect(parsed.accession).toBe("MD-A007L3");
    expect(parsed.analyses).toHaveLength(21);
    expect(parsed.metadata?.BOXTYPE).toBe("orthorhombic triclinic");
  });

  it("drops fields of the wrong type instead of failing", () => {
    const parsed = parse({ accession: "MD-X", metadata: { TEMP: "hot", mdFrames: 5 }, analyses: null });
    expect(parsed.metadata?.TEMP).toBeUndefined();
    expect(parsed.metadata?.mdFrames).toBe(5);
  });

  it("requires an accession", () => {
    expect(replicaProjectSchema.safeParse({ metadata: {} }).success).toBe(false);
  });
});

describe("toReplicaDetail", () => {
  it("maps the captured fixture", () => {
    const detail = toReplicaDetail(parse(fixture), ref);
    expect(detail).toMatchObject({
      ...ref,
      forceFields: ["ff19SB", "GAFF"],
      waterModel: "OPC",
      frames: 25031,
      frameStepNs: 0.1,
      timestepFs: 2,
      temperatureK: 310,
      ensemble: "NPT",
      atoms: 19686,
      dataType: "trajectory",
      box: { types: ["orthorhombic triclinic"], xNm: 16.7016, yNm: 9.9124, zNm: 11.8971 },
      composition: {
        total: { atoms: 19686, residues: 1256 },
        protein: { atoms: 19631, residues: 1250 },
        nucleic: { atoms: 0, residues: 0 },
        lipids: { atoms: 0, residues: 0 },
        carbohydrates: { atoms: 50, residues: 1 },
        solvent: { atoms: 0, residues: 0 },
      },
      ions: { cations: 0, anions: 0, total: 0 },
    });
    expect(detail.analyses).toHaveLength(21);
  });

  it("keeps missing as null and zero as 0", () => {
    const detail = toReplicaDetail(parse({ accession: "MD-X", metadata: { LIPIATS: 0, BOXTYPE: null, FF: null } }), ref);
    expect(detail.composition.lipids.atoms).toBe(0);
    expect(detail.composition.protein.atoms).toBeNull();
    expect(detail.composition.nucleic.atoms).toBeNull();
    expect(detail.frames).toBeNull();
    expect(detail.box.types).toEqual([]);
    expect(detail.forceFields).toEqual([]);
    expect(detail.ions.total).toBeNull();
  });

  it("sums DNA and RNA, falls back to the ion parts and dedupes box types", () => {
    const detail = toReplicaDetail(
      parse({ accession: "MD-X", metadata: { DNAATS: 10, RNAATS: 5, DNARES: 1, COUNCAT: 3, COUNANI: 4, BOXTYPE: ["cubic", "cubic", " "] } }),
      ref,
    );
    expect(detail.composition.nucleic).toEqual({ atoms: 15, residues: 1 });
    expect(detail.ions).toEqual({ cations: 3, anions: 4, total: 7 });
    expect(detail.box.types).toEqual(["cubic"]);
  });

  it("falls back to SYSTATS when mdAtoms is missing", () => {
    expect(toReplicaDetail(parse({ accession: "MD-X", metadata: { SYSTATS: 12 } }), ref).atoms).toBe(12);
  });

  it("turns warnings into text lines", () => {
    const detail = toReplicaDetail(parse({ accession: "MD-X", metadata: { WARNINGS: ["a", { message: "b" }, { code: 1 }, {}, null] } }), ref);
    expect(detail.warnings).toEqual(["a", "b", "{\"code\":1}"]);
  });
});
