import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { clustersSchema, parseWith, type ClustersData } from "@/entities/analysis";
import { clusterBars, rangeText, resolveClusterIndex, resolvedTransitions, topTransitions, totalFrames, transitionMatrix } from "./model";

const load = (name: string): unknown =>
  JSON.parse(readFileSync(join(process.cwd(), "src/mocks/fixtures/mdposit/analyses", `${name}.json`), "utf8"));

const parsed = (): ClustersData => {
  const result = parseWith(clustersSchema, load("clusters-00"));
  if (!result.ok) throw new Error(result.issue.message);
  return result.data;
};

const small: ClustersData = {
  name: "x",
  cutoff: 0.3,
  step: 1,
  version: null,
  clusters: [
    { frames: [1, 2, 3], main: 100 },
    { frames: [4], main: 200 },
  ],
  transitions: [
    { from: 0, to: 1, count: 2 },
    { from: 0, to: 1, count: 3 },
    { from: 200, to: 100, count: 1 },
    { from: 7, to: 0, count: 9 },
  ],
};

describe("clusters model", () => {
  it("sorts populations largest first and counts frames", () => {
    const bars = clusterBars(small);
    expect(bars.map((b) => b.label)).toEqual(["Cluster 1 (frame 100)", "Cluster 2 (frame 200)"]);
    expect(totalFrames(small)).toBe(4);
    expect(clusterBars(parsed(), 20).length).toBeLessThanOrEqual(20);
  });

  it("resolves from/to as a position first, then by main frame, and drops unknown ones", () => {
    expect(resolveClusterIndex(small, 1)).toBe(1);
    expect(resolveClusterIndex(small, 200)).toBe(1);
    expect(resolveClusterIndex(small, 7)).toBe(-1);
    expect(resolvedTransitions(small)).toHaveLength(3);
  });

  it("builds an origin by destination count matrix", () => {
    const matrix = transitionMatrix(small, resolvedTransitions(small));
    expect(matrix.rows).toBe(2);
    expect(matrix.cols).toBe(2);
    expect(matrix.values[0 * 2 + 1]).toBe(5);
    expect(matrix.values[1 * 2 + 0]).toBe(1);
    expect(rangeText(matrix.rowRanges[1])).toBe("Cluster 2");
    expect(rangeText([0, 3])).toBe("Cluster 1 to Cluster 4");
  });

  it("merges repeated pairs in the top list", () => {
    expect(topTransitions(resolvedTransitions(small))[0]).toMatchObject({
      from: 0,
      to: 1,
      count: 5,
    });
  });

  it("handles the captured payload", () => {
    const data = parsed();
    const matrix = transitionMatrix(data, resolvedTransitions(data));
    expect(matrix.rows).toBe(data.clusters.length);
    expect(topTransitions(resolvedTransitions(data)).length).toBeLessThanOrEqual(6);
  });
});
