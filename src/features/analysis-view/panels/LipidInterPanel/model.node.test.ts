import { describe, expect, it } from "vitest";
import { lipidInterSchema } from "@/entities/analysis";
import { parseSynthetic } from "../testing/membraneFixtures";
import { activeLipids, lipidLabels, matrixRows, peakValue, rowOrder, topLipids, topResidues, visibleLipids } from "./model";

describe("lipid-inter model (fixture-only synthetic data)", () => {
  const data = parseSynthetic(lipidInterSchema, "lipid-inter");
  const lipids = activeLipids(data);

  it("drops all-zero species", () => {
    expect(data.lipids).toHaveLength(4);
    expect(lipids).toHaveLength(3);
  });

  it("keeps truncated labels unique while the key stays complete", () => {
    const labels = lipids.map((l) => l.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels[0]).toContain("...");
    expect(lipids[0]!.key).toBe("KLFCQYBPXXKHIA-UHFFFAOYSA-N");
    expect(lipidLabels(["short"])).toEqual(["short"]);
    expect(lipidLabels(["AAAAAAAAAAAAAAAAAAAA-1", "AAAAAAAAAAAAAAAAAAAA-2"])).toEqual(["AAAAAAAAAAAAAAAA... #1", "AAAAAAAAAAAAAAAA... #2"]);
  });

  it("sorts rows without mutating residues and filters by lipid", () => {
    const byMax = rowOrder(lipids, data.residues.length, "max");
    const maxes = byMax.map((row) => Math.max(...lipids.map((l) => l.values[row]!)));
    for (let i = 1; i < maxes.length; i++) expect(maxes[i - 1]!).toBeGreaterThanOrEqual(maxes[i]!);
    expect(rowOrder(lipids, 3, "residue")).toEqual([0, 1, 2]);
    expect(visibleLipids(lipids, lipids[1]!.key)).toHaveLength(1);
    expect(matrixRows(lipids, [0])[0]).toHaveLength(3);
  });

  it("ranks residues and species and finds the peak", () => {
    expect(topResidues(lipids, data.residues, 2)).toHaveLength(2);
    expect(topLipids(lipids)[0]!.total).toBeGreaterThanOrEqual(topLipids(lipids)[1]!.total);
    expect(peakValue(lipids)).toBeGreaterThan(0);
    expect(peakValue([])).toBeNull();
  });
});
