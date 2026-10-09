import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseWith, pocketsSchema, type PocketsData } from "@/entities/analysis";
import { pocketsSummary, rankPockets, summarizePockets, volumeSeries } from "./model";

const load = (name: string): unknown =>
  JSON.parse(readFileSync(join(process.cwd(), "src/mocks/fixtures/mdposit/analyses", `${name}.json`), "utf8"));

const parsed = (): PocketsData => {
  const result = parseWith(pocketsSchema, load("pockets"));
  if (!result.ok) throw new Error(result.issue.message);
  return result.data;
};

describe("pockets model", () => {
  it("reads the top-level start and step of the captured payload", () => {
    const data = parsed();
    expect(data.step).toBe(251);
    const series = volumeSeries(data.data[0]!.volumes, data.start, data.step);
    expect(series[1]![0]).toBe(data.start + 251);
    expect(series).toHaveLength(data.data[0]!.volumes.length);
  });

  it("ranks pockets with the largest average first, capped at the limit", () => {
    const pockets = summarizePockets(parsed());
    const ranked = rankPockets(pockets, 3);
    expect(ranked).toHaveLength(3);
    expect(ranked[0]!.stats!.mean).toBeGreaterThanOrEqual(ranked[1]!.stats!.mean);
    expect(ranked[1]!.stats!.mean).toBeGreaterThanOrEqual(ranked[2]!.stats!.mean);
  });

  it("keeps ids unique for equal names and breaks the line at missing volumes", () => {
    const data: PocketsData = {
      start: 0,
      step: 1,
      data: [
        { name: "p", volumes: [1, NaN, 3], atoms: [1] },
        { name: "p", volumes: [], atoms: [] },
      ],
    };
    const pockets = summarizePockets(data);
    expect(pockets.map((p) => p.id)).toEqual(["0", "1"]);
    expect(pockets[0]!.stats).toMatchObject({ mean: 2, count: 2 });
    expect(pockets[1]!.stats).toBeNull();
    expect(rankPockets(pockets)).toHaveLength(1);
    expect(volumeSeries(data.data[0]!.volumes, 0, 1)[1]![1]).toBeNaN();
  });

  it("describes an empty analysis", () => {
    expect(pocketsSummary([], 0)).toBe("No pockets in this analysis");
  });
});
