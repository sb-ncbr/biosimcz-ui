import { describe, expect, it } from "vitest";
import { memMapSchema } from "@/entities/analysis";
import { parseSynthetic } from "../testing/membraneFixtures";
import { ALL_MEMBRANES, membraneRows, memMapSummary, previewIndices } from "./model";

describe("mem-map model (fixture-only synthetic data)", () => {
  const data = parseSynthetic(memMapSchema, "mem-map");

  it("lists all membranes or one", () => {
    expect(membraneRows(data, ALL_MEMBRANES).map((r) => r.id)).toEqual(["1", "2"]);
    expect(membraneRows(data, "2")).toHaveLength(1);
    expect(membraneRows(data, "9")).toEqual([]);
  });

  it("previews long index lists", () => {
    expect(previewIndices([1, 2, 3], 2)).toBe("1, 2, +1 more");
    expect(previewIndices([])).toBe("None recorded");
  });

  it("summarises counts", () => {
    expect(memMapSummary(membraneRows(data, ALL_MEMBRANES))).toContain("2 membranes");
    expect(memMapSummary([])).toBe("No membranes to show");
  });
});
