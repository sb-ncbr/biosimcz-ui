import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pairwiseSchema, parseWith, type PairwiseData } from "@/entities/analysis";
import { buildPairwiseModel, effectiveMatrix, pairwiseTooltip, readVariant } from "./model";

const FIXTURES = join(process.cwd(), "src/mocks/fixtures/mdposit/analyses");
const load = (path: string): PairwiseData => {
  const result = parseWith(pairwiseSchema, JSON.parse(readFileSync(join(FIXTURES, path), "utf8")));
  if (!result.ok) throw new Error(result.issue.message);
  return result.data;
};

const square = (n: number): PairwiseData => ({
  start: 0,
  step: 1,
  matrices: [
    {
      name: "big",
      values: Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => r * 1000 + c)),
    },
  ],
});

describe("PairwisePanel model", () => {
  it("draws the live matrix unbinned and keeps raw statistics", () => {
    const model = buildPairwiseModel(load("rmsd-pairwise-00.json"), null);
    expect(model.matrix).toMatchObject({
      rows: 64,
      cols: 64,
      rowStride: 1,
      colStride: 1,
    });
    expect(model.stats!.count).toBe(64 * 64);
    expect(model.note).toContain("Every one of the 64 x 64 raw values is drawn");
    expect(model.rowLabels[1]).toBe("126");
  });

  it("keeps row-major orientation for a non-square matrix", () => {
    const data: PairwiseData = {
      start: 0,
      step: 1,
      matrices: [
        {
          name: "a",
          values: [
            [1, 2, 3],
            [4, 5, 6],
          ],
        },
      ],
    };
    const model = buildPairwiseModel(data, null);
    expect(Array.from(model.matrix!.values)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(pairwiseTooltip(model)({ row: 1, col: 0, value: 4 })[2]!.value).toBe("4.000");
  });

  it("bins to at most 512 per side and says so", () => {
    const model = buildPairwiseModel(square(1100), null);
    expect(model.matrix).toMatchObject({
      rows: 367,
      cols: 367,
      rowStride: 3,
      colStride: 3,
    });
    expect(model.note).toContain("mean of up to 3 x 3 of the 1100 x 1100 raw values");
    expect(model.stats!.max).toBe(1099 * 1000 + 1099);
  });

  it("derives the effective matrix from the data", () => {
    const data = load("rmsd-pairwise-00.json");
    expect(effectiveMatrix(data, "5")).toBe("0");
    expect(effectiveMatrix({ ...data, matrices: [] }, "0")).toBe("");
    expect(buildPairwiseModel({ ...data, matrices: [] }, null).emptyReason).toBe("No pairwise matrix in this analysis");
  });

  it("parses the synthetic interface fixture with the same model", () => {
    const model = buildPairwiseModel(load("synthetic/rmsd-pairwise-interface.json"), null);
    expect(model.emptyReason).toBeNull();
    expect(model.name).toBe("Interface (synthetic)");
    expect(readVariant({ variant: "interface" })).toBe("interface");
    expect(readVariant(undefined)).toBe("global");
  });
});
