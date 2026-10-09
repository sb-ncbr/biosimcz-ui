import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fluctuationSchema, parseWith, rgyrSchema, rmsdSchema } from "@/entities/analysis";
import { buildStatSeriesModel, readConfig } from "./model";

const FIXTURES = join(process.cwd(), "src/mocks/fixtures/mdposit/analyses");
const load = (path: string): unknown => JSON.parse(readFileSync(join(FIXTURES, `${path}.json`), "utf8"));

const parsed = <T,>(result: ReturnType<typeof parseWith<T>>): T => {
  if (!result.ok) throw new Error(result.issue.message);
  return result.data;
};

describe("StatSeriesPanel model", () => {
  it("builds four rgyr series from the captured payload with the frame axis", () => {
    const data = parsed(parseWith(rgyrSchema, load("rgyr")));
    const config = readConfig({ title: "Radius of gyration", quantity: "Rg", seriesNames: { rgyr: "Rg", rgyrx: "Rg X" } });
    const model = buildStatSeriesModel(data, config, "rgyr");
    expect(model.lines.map((line) => line.name)).toEqual(["Rg", "Rg X", "rgyry", "rgyrz"]);
    expect(model.lines[0]!.data[1]![0]).toBe(data.start + data.step);
    expect(model.lines[0]!.data).toHaveLength(data.series[0]!.data.length);
    expect(model.empty).toBe(false);
    expect(model.summary).toContain("Rg: mean");
    expect(model.summary).toContain("nm?");
  });

  it("uses an index axis for fluctuation, which has no start or step", () => {
    const data = parsed(parseWith(fluctuationSchema, load("fluctuation")));
    const model = buildStatSeriesModel(data, readConfig({ indexAxis: true, seriesNames: { rmsf: "RMSF" } }), "fluctuation");
    expect(model.lines[0]!.data.slice(0, 3).map(([x]) => x)).toEqual([0, 1, 2]);
  });

  // Fixture-only: rmsd is 404 on the live replica, so this payload is synthetic (start 10, step 5).
  it("honours start and step for rmsd", () => {
    const data = parsed(parseWith(rmsdSchema, load("synthetic/rmsd")));
    const model = buildStatSeriesModel(data, readConfig({ title: "RMSD", seriesNames: { rmsd: "RMSD" } }), "rmsd");
    expect(model.lines[0]!.data.map(([x]) => x)).toEqual([10, 15, 20, 25, 30]);
    expect(model.rows[0]!.stats).toMatchObject({ mean: 0.25, std: 0.1 });
  });

  it("falls back to computed stats when backend values are not finite and flags empty series", () => {
    const model = buildStatSeriesModel(
      { start: 0, step: 1, series: [{ key: "rmsd", stats: { mean: NaN, std: NaN, min: NaN, max: NaN, count: 0 }, data: [] }] },
      readConfig(undefined),
      "rmsd",
    );
    expect(model.empty).toBe(true);
    expect(model.rows[0]!.stats).toBeNull();
  });

  it("does not spread huge arrays", () => {
    const big = Array.from({ length: 300_000 }, (_, i) => i);
    const model = buildStatSeriesModel(
      { start: 0, step: 1, series: [{ key: "rmsd", stats: { mean: NaN, std: NaN, min: NaN, max: NaN, count: 0 }, data: big }] },
      readConfig(undefined),
      "rmsd",
    );
    expect(model.rows[0]!.stats).toMatchObject({ min: 0, max: 299_999 });
  });
});
