import { describe, expect, it } from "vitest";
import { aplSchema, parseWith, type AplData } from "@/entities/analysis";
import { parseSynthetic } from "../testing/membraneFixtures";
import { aplStats, gridLabels, gridResolution, medianSeries, sharedRange } from "./model";

describe("apl model (fixture-only synthetic data)", () => {
  const data = parseSynthetic(aplSchema, "apl");

  it("uses one value range over both leaflets", () => {
    const range = sharedRange(data)!;
    for (const matrix of [data.upper, data.lower]) {
      for (const row of matrix) for (const v of row) expect(v >= range.min && v <= range.max).toBe(true);
    }
    expect(sharedRange({ ...data, upper: [], lower: [] })).toBeNull();
  });

  it("builds a median band from std and drops it on a length mismatch", () => {
    const [series] = medianSeries(data);
    expect(series!.band!.upper).toHaveLength(data.median.length);
    expect(series!.band!.upper[0]![1]).toBeGreaterThan(series!.band!.lower[0]![1]);
    expect(medianSeries({ ...data, std: [1, 2] })[0]!.band).toBeUndefined();
  });

  it("accepts scalar median and std (unknown upstream shape) without a chart series", () => {
    const parsed = parseWith(aplSchema, { data: { "upper leaflet": [[1, 2]], median: 63.5, std: 2 } });
    expect(parsed.ok).toBe(true);
    const scalar = (parsed as { ok: true; data: AplData }).data;
    expect(medianSeries(scalar)).toEqual([]);
    expect(aplStats(scalar).median!.mean).toBe(63.5);
  });

  it("labels axes from the grid and falls back to indices", () => {
    expect(gridLabels([0, 2.5], 2, "X")).toEqual(["0.0", "2.5"]);
    expect(gridLabels([0], 2, "Y")).toEqual(["Y 1", "Y 2"]);
    expect(gridResolution(data)).toBe("16 × 12");
  });
});
