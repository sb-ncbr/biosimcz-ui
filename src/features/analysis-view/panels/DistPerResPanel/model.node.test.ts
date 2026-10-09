import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { distPerResSchema, parseWith, type DistPerResData } from "@/entities/analysis";
import { buildDistPerResModel, defaultView, extremePairs } from "./model";

const FIXTURES = join(process.cwd(), "src/mocks/fixtures/mdposit/analyses");
const load = (): DistPerResData => {
  const result = parseWith(distPerResSchema, JSON.parse(readFileSync(join(FIXTURES, "dist-perres-00.json"), "utf8")));
  if (!result.ok) throw new Error(result.issue.message);
  return result.data;
};

describe("DistPerResPanel model", () => {
  it("accepts the live 1 x N matrix and lists the closest pairs ascending in the mean view", () => {
    const model = buildDistPerResModel(load(), null, null, "dist-perres-00");
    expect(model.view).toBe("means");
    expect(model.matrix).toMatchObject({ rows: 1, cols: 64 });
    expect(model.pairs).toHaveLength(6);
    const values = model.pairs.map((pair) => Number(pair.value));
    expect([...values].sort((a, b) => a - b)).toEqual(values);
    expect(model.pairs[0]!.label).toMatch(/^Agent 1 residue \d+ - Agent 2 residue 1$/);
  });

  it("lists the most variable pairs descending in the std view", () => {
    const model = buildDistPerResModel(load(), null, "stdvs", "dist-perres-00");
    const values = model.pairs.map((pair) => Number(pair.value));
    expect([...values].sort((a, b) => b - a)).toEqual(values);
    expect(model.summary).toContain("distance variability");
  });

  it("opens the -stdv name on the std view and lets the select override it", () => {
    expect(defaultView("dist-perres-stdv")).toBe("stdvs");
    expect(buildDistPerResModel(load(), null, null, "dist-perres-stdv").view).toBe("stdvs");
    expect(buildDistPerResModel(load(), null, "means", "dist-perres-stdv").view).toBe("means");
  });

  it("reports an empty reason when the chosen view has no matrix, keeping both selections valid", () => {
    const data: DistPerResData = { data: [{ name: "x", means: [[1, 2]], stdvs: null }] };
    const model = buildDistPerResModel(data, "9", "stdvs", "dist-perres");
    expect(model.interactionId).toBe("0");
    expect(model.emptyReason).toContain("no distance variability matrix");
    expect(model.options).toHaveLength(1);
  });

  it("ignores NaN cells and keeps only the requested number of pairs", () => {
    const pairs = extremePairs(
      [
        [NaN, 5, 1],
        [3, 2, NaN],
      ],
      2,
      "asc",
    );
    expect(pairs.map((pair) => pair.value)).toEqual([1, 2]);
    expect(extremePairs([[NaN]], 3, "desc")).toEqual([]);
  });
});
