import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseWith, sasaSchema, type SasaData } from "@/entities/analysis";
import { rankResidues, residueLabel, sasaSummary, summarizeResidues, toPoints } from "./model";

const load = (name: string): unknown =>
  JSON.parse(readFileSync(join(process.cwd(), "src/mocks/fixtures/mdposit/analyses", `${name}.json`), "utf8"));

const parsed = (): SasaData => {
  const result = parseWith(sasaSchema, load("sasa"));
  if (!result.ok) throw new Error(result.issue.message);
  return result.data;
};

describe("sasa model", () => {
  it("ranks residues largest first and caps the list", () => {
    const residues = summarizeResidues(parsed());
    const ranked = rankResidues(residues, 5);
    expect(ranked).toHaveLength(5);
    for (let i = 1; i < ranked.length; i++) expect(ranked[i - 1]!.stats!.mean).toBeGreaterThanOrEqual(ranked[i]!.stats!.mean);
    expect(ranked[0]!.label).toBe(residueLabel(ranked[0]!.index));
  });

  it("scales the x axis by the frame step", () => {
    const data = parsed();
    const points = toPoints(data.total, data.step);
    expect(points[2]![0]).toBe(2 * data.step);
    expect(points).toHaveLength(data.total.length);
  });

  it("skips residues without finite samples and summarises the total", () => {
    const data: SasaData = {
      step: 1,
      perResidue: [Float64Array.from([NaN, NaN]), Float64Array.from([1, 3])],
      total: Float64Array.from([1, 3]),
    };
    const residues = summarizeResidues(data);
    expect(rankResidues(residues).map((r) => r.index)).toEqual([1]);
    expect(sasaSummary(2, 2, residues[1]!.stats)).toContain("total mean 2.0");
    expect(sasaSummary(0, 0, null)).toBe("No finite SASA samples");
  });
});
