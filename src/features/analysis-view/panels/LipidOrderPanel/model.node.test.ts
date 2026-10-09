import { describe, expect, it } from "vitest";
import { lipidOrderSchema } from "@/entities/analysis";
import { parseSynthetic } from "../testing/membraneFixtures";
import { emptyReason, lipidNames, orderSeries, orderStats, segmentNames, segmentOf } from "./model";

describe("lipid-order model (fixture-only synthetic data)", () => {
  const data = parseSynthetic(lipidOrderSchema, "lipid-order");

  it("lists lipids and segments, including a lipid without segments", () => {
    expect(lipidNames(data)).toEqual(["POPC", "CHOL"]);
    expect(segmentNames(data, "POPC")).toEqual(["sn1", "sn2"]);
    expect(segmentNames(data, "CHOL")).toEqual([]);
    expect(segmentOf(data, "CHOL", "sn1")).toBeNull();
  });

  it("draws the std as a band and computes statistics", () => {
    const segment = segmentOf(data, "POPC", "sn1");
    const [series] = orderSeries(segment);
    expect(series!.band!.upper).toHaveLength(14);
    expect(series!.data[0]![0]).toBe(1);
    expect(orderStats(segment).positions).toBe(14);
    expect(orderStats(segment).avg!.max).toBeCloseTo(0.2);
  });

  it("gives a reason for each empty state", () => {
    expect(orderSeries(null)).toEqual([]);
    expect(emptyReason(0, 0)).toContain("No lipid order data");
    expect(emptyReason(2, 0)).toContain("usable segment data");
  });
});
