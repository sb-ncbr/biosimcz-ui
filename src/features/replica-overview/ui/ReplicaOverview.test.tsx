import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ReplicaDetail } from "@/entities/replica";
import { ReplicaOverview } from "./ReplicaOverview";

const empty = { atoms: null, residues: null };
const replica: ReplicaDetail = {
  accession: "MD-A007L3",
  name: "replica_1",
  number: 1,
  instanceId: "MD-A007L3.1",
  analyses: [],
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
  composition: { total: { atoms: 19686, residues: 1256 }, protein: empty, nucleic: { atoms: 0, residues: 0 }, lipids: empty, carbohydrates: empty, solvent: empty },
  ions: { cations: null, anions: null, total: null },
  warnings: [],
};

describe("ReplicaOverview", () => {
  it("renders the five cards with formatted values", () => {
    render(<ReplicaOverview replica={replica} />);
    for (const title of ["Force Field & Water Model", "Simulation Parameters", "Simulation Box", "System Composition", "Counter-Ions"]) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
    expect(screen.getByText("2,503.1 ns")).toBeInTheDocument();
    expect(screen.getByText("ff19SB")).toBeInTheDocument();
    expect(screen.getByText("16.702 nm")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Warnings" })).not.toBeInTheDocument();
  });

  it("shows warnings first when present", () => {
    render(<ReplicaOverview replica={{ ...replica, warnings: ["Missing hydrogens"] }} />);
    expect(screen.getByRole("region", { name: "Warnings" })).toHaveTextContent("Missing hydrogens");
  });
});
