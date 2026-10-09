import { describe, expect, it } from "vitest";
import { thicknessSchema } from "@/entities/analysis";
import { parseSynthetic } from "../testing/membraneFixtures";
import { gapMean, leafletSeries, midplaneSeries, thicknessStats } from "./model";

describe("thickness model (fixture-only synthetic data)", () => {
  const data = parseSynthetic(thicknessSchema, "thickness");

  it("draws std as bands on every series that has one", () => {
    const series = leafletSeries(data);
    expect(series.map((s) => s.name)).toEqual(["Thickness", "Mean positive", "Mean negative"]);
    expect(series.every((s) => s.band !== undefined)).toBe(true);
    expect(series[0]!.data).toHaveLength(data.thickness.length);
  });

  it("omits the band and the midplane when the arrays are missing", () => {
    const bare = { ...data, std_thickness: undefined, midplane_z: undefined };
    expect(leafletSeries(bare)[0]!.band).toBeUndefined();
    expect(midplaneSeries(bare)).toEqual([]);
  });

  it("computes statistics and the leaflet gap", () => {
    const stats = thicknessStats(data);
    expect(stats.thickness!.count).toBe(60);
    expect(stats.std!.mean).toBeCloseTo(1.1);
    expect(stats.gap!).toBeGreaterThan(30);
    expect(gapMean([1], undefined)).toBeNull();
  });
});
