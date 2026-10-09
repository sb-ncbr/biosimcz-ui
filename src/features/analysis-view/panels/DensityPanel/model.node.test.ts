import { describe, expect, it } from "vitest";
import { densitySchema } from "@/entities/analysis";
import { parseSynthetic } from "../testing/membraneFixtures";
import { availableMetrics, componentRows, densitySeries, metricInfo, peakOf } from "./model";

describe("density model (fixture-only synthetic data)", () => {
  const data = parseSynthetic(densitySchema, "density");

  it("lists only metrics present in some component", () => {
    expect(availableMetrics(data)).toEqual(["number", "mass", "charge", "electron"]);
    expect(availableMetrics({ z: [], comps: [] })).toEqual([]);
  });

  it("builds one series per component that has the metric", () => {
    expect(densitySeries(data, "number", "dens")).toHaveLength(2);
    expect(densitySeries(data, "electron", "dens").map((s) => s.name)).toEqual(["Water"]);
    expect(densitySeries(data, "number", "stdv")[0]!.data).toHaveLength(data.z.length);
  });

  it("states units for each metric and keeps the signed peak", () => {
    expect(metricInfo("mass").unit.text).toBe("amu/Å^3");
    expect(peakOf([0.1, -0.4, 0.2])).toBe(-0.4);
    expect(peakOf([])).toBeNull();
    expect(componentRows(data, "mass", "dens")[1]!.selectionSize).toBe("2");
  });
});
