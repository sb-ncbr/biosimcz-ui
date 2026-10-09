import { describe, expect, it } from "vitest";
import type { ReplicaDetail } from "@/entities/replica";
import { compositionRows, counterIonRows, forceFieldRows, simulationBoxRows, simulationParameterRows } from "./rows";

const empty = { atoms: null, residues: null };
const base: ReplicaDetail = {
  accession: "MD-A007L3",
  name: "replica_1",
  number: 1,
  instanceId: "MD-A007L3.1",
  analyses: [],
  forceFields: [],
  waterModel: null,
  frames: null,
  frameStepNs: null,
  timestepFs: null,
  temperatureK: null,
  ensemble: null,
  atoms: null,
  dataType: null,
  box: { types: [], xNm: null, yNm: null, zNm: null },
  composition: { total: empty, protein: empty, nucleic: empty, lipids: empty, carbohydrates: empty, solvent: empty },
  ions: { cations: null, anions: null, total: null },
  warnings: [],
};

const value = (rows: readonly { label: string; value: string }[], label: string) => rows.find((row) => row.label === label)?.value;

describe("simulationParameterRows", () => {
  it("formats the real replica without float artefacts", () => {
    const rows = simulationParameterRows({ ...base, frames: 25031, frameStepNs: 0.1, timestepFs: 2, temperatureK: 310, ensemble: "NPT" });
    expect(value(rows, "Frames")).toBe("25,031");
    expect(value(rows, "Frequency")).toBe("100 ps");
    expect(value(rows, "Simulation length")).toBe("2,503.1 ns");
    expect(value(rows, "Timestep")).toBe("2 fs");
    expect(value(rows, "Temperature")).toBe("310 K");
    expect(value(rows, "Ensemble")).toBe("NPT");
  });

  it("shows N/A for missing and 0 for zero", () => {
    expect(value(simulationParameterRows(base), "Frames")).toBe("N/A");
    expect(value(simulationParameterRows(base), "Simulation length")).toBe("N/A");
    expect(value(simulationParameterRows({ ...base, frames: 0, temperatureK: 0 }), "Frames")).toBe("0");
    expect(value(simulationParameterRows({ ...base, temperatureK: 0 }), "Temperature")).toBe("0 K");
  });
});

describe("simulationBoxRows", () => {
  it("uses 3 decimals for edges and 2 for the volume", () => {
    const rows = simulationBoxRows({ ...base, box: { types: ["orthorhombic triclinic"], xNm: 16.7016, yNm: 9.9124, zNm: 11.8971 } });
    expect(rows.edges.map((row) => row.value)).toEqual(["16.702 nm", "9.912 nm", "11.897 nm"]);
    expect(rows.volume.value).toBe("1,969.60 nm³");
    expect(rows.types).toEqual(["orthorhombic triclinic"]);
  });

  it("has no volume when an edge is missing and dedupes types", () => {
    const rows = simulationBoxRows({ ...base, box: { types: ["cubic", "cubic"], xNm: 1, yNm: null, zNm: 3 } });
    expect(rows.volume.value).toBe("N/A");
    expect(rows.edges[1]?.value).toBe("N/A");
    expect(rows.types).toEqual(["cubic"]);
  });
});

describe("compositionRows", () => {
  it("keeps zero and N/A apart", () => {
    const rows = compositionRows({
      ...base,
      composition: { ...base.composition, total: { atoms: 19686, residues: 1256 }, nucleic: { atoms: 0, residues: 0 } },
    });
    expect(rows.find((row) => row.label === "Total system")).toEqual({ label: "Total system", atoms: "19,686", residues: "1,256" });
    expect(rows.find((row) => row.label === "Nucleic acids")).toMatchObject({ atoms: "0", residues: "0" });
    expect(rows.find((row) => row.label === "Solvent")).toMatchObject({ atoms: "N/A", residues: "N/A" });
  });
});

describe("other cards", () => {
  it("counter ions", () => {
    expect(counterIonRows({ ...base, ions: { cations: 0, anions: 12, total: null } }).map((row) => row.value)).toEqual(["0", "12", "N/A"]);
  });

  it("force field", () => {
    expect(forceFieldRows({ ...base, forceFields: ["ff19SB"], waterModel: "OPC" })).toEqual({ forceFields: ["ff19SB"], waterModel: "OPC" });
    expect(forceFieldRows(base).waterModel).toBe("N/A");
  });
});
