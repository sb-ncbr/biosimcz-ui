import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseWith, pcaSchema, type PcaData } from "@/entities/analysis";
import { axisLabel, buildPcaModel, effectiveComponents, pcaSummary, scatterCsv, scatterInput } from "./model";

const load = (name: string): unknown =>
  JSON.parse(readFileSync(join(process.cwd(), "src/mocks/fixtures/mdposit/analyses", `${name}.json`), "utf8"));

const parsed = (): PcaData => {
  const result = parseWith(pcaSchema, load("pca"));
  if (!result.ok) throw new Error(result.issue.message);
  return result.data;
};

describe("pca model", () => {
  it("counts components from the projection rows of the captured payload", () => {
    const data = parsed();
    expect(data.components).toBe(14);
    const model = buildPcaModel(data);
    expect(model.options).toHaveLength(14);
    expect(model.variance).toHaveLength(14);
    expect(model.variance[0]).toBeGreaterThan(0);
  });

  it("colours the scatter by frame index with no brush data", () => {
    const data = parsed();
    const points = scatterInput(data, 1, 2);
    expect(points.x).toBe(data.projections[0]);
    expect(points.y).toBe(data.projections[1]);
    expect([...points.color.slice(0, 3)]).toEqual([0, 1, 2]);
    expect(points.color).toHaveLength(Math.min(data.projections[0]!.length, data.projections[1]!.length));
  });

  it("derives the selection and falls back when the stored one disappears", () => {
    expect(effectiveComponents({ x: null, y: null }, 14)).toEqual({
      x: 1,
      y: 2,
    });
    expect(effectiveComponents({ x: "5", y: "3" }, 14)).toEqual({ x: 5, y: 3 });
    expect(effectiveComponents({ x: "30", y: "x" }, 4)).toEqual({ x: 1, y: 2 });
  });

  it("labels axes with the explained variance and writes a csv", () => {
    const model = buildPcaModel({
      eigenvalues: [3, 1],
      projections: [
        [1, 2],
        [3, 4],
      ],
      components: 2,
    });
    expect(axisLabel(1, model.variance)).toBe("PC1 (75.0%)");
    expect(axisLabel(9, model.variance)).toBe("PC9");
    expect(pcaSummary(model)).toContain("PC1 holds 75.0%");
    expect(
      scatterCsv(
        scatterInput(
          {
            eigenvalues: [],
            projections: [
              [1, 2],
              [3, 4],
            ],
            components: 2,
          },
          1,
          2,
        ),
        "a",
        "b",
      ),
    ).toBe("frame,a,b\n0,1,3\n1,2,4");
  });
});
