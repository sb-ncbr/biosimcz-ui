import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hbondsSchema, parseWith, type HbondsData } from "@/entities/analysis";
import { bondsPerBlock, buildHbondsModel, describeBond, hbondsTooltip, topBonds } from "./model";

const FIXTURES = join(process.cwd(), "src/mocks/fixtures/mdposit/analyses");
const load = (): HbondsData => {
  const result = parseWith(hbondsSchema, JSON.parse(readFileSync(join(FIXTURES, "hbonds-00.json"), "utf8")));
  if (!result.ok) throw new Error(result.issue.message);
  return result.data;
};

describe("HbondsPanel model", () => {
  it("builds the heatmap, the per-block line and the occupancy list from the live fraction payload", () => {
    const model = buildHbondsModel(load(), null);
    expect(model.bonds).toBe(22);
    expect(model.heat).toMatchObject({ rows: 22, cols: 64, rowStride: 1, colStride: 1 });
    expect(model.line).toHaveLength(64);
    expect(model.line[0]![0]).toBe(1);
    expect(model.top).toHaveLength(6);
    const shares = model.top.map((item) => Number.parseInt(item.value, 10));
    expect([...shares].sort((a, b) => b - a)).toEqual(shares);
    expect(model.top[0]!.label).toMatch(/^Bond \d+: D \d+ -> A \d+ \(H \d+\)$/);
  });

  it("words the tooltip as a share of frames", () => {
    const model = buildHbondsModel(load(), null);
    const rows = hbondsTooltip(model)({ row: 0, col: 0, value: 0.37 });
    expect(rows.find((row) => row.label === "Occupancy")!.value).toBe("formed in 37% of frames");
    expect(rows.some((row) => row.label === "Atoms")).toBe(true);
  });

  it("sums fractions per block and bins large bond lists to 400 per side", () => {
    expect(
      bondsPerBlock([
        [0.5, 1],
        [0.5, 0],
      ]),
    ).toEqual([
      [1, 1],
      [2, 1],
    ]);
    const big: HbondsData = {
      interactions: [
        {
          name: "big",
          donors: [],
          acceptors: [],
          hydrogens: [],
          occupancy: [],
          timed: Array.from({ length: 900 }, () => new Float64Array(1000).fill(0.5)),
        },
      ],
    };
    const model = buildHbondsModel(big, null);
    expect(model.heat).toMatchObject({ rows: 300, cols: 334 });
  });

  it("marks missing atom indices with ? and explains a missing time series", () => {
    const entry = { name: "o", donors: [4], acceptors: [], hydrogens: [], occupancy: [0.2, 0.9], timed: [] };
    expect(describeBond(entry, 0)).toBe("D 4 -> A ? (H ?)");
    expect(topBonds(entry).map((item) => item.value)).toEqual(["90%", "20%"]);
    const model = buildHbondsModel({ interactions: [entry] }, "7");
    expect(model.interactionId).toBe("0");
    expect(model.heatEmpty).toContain("no per-block series");
  });

  it("keeps an empty selection valid", () => {
    const model = buildHbondsModel({ interactions: [] }, "0");
    expect(model.interactionId).toBe("");
    expect(model.heatEmpty).toBe("No hydrogen bond data in this analysis");
  });
});
