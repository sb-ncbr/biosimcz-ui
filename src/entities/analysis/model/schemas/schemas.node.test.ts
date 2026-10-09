import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { z } from "zod";
import { describe, expect, it } from "vitest";
import { parseWith } from "../parse";
import {
  aplSchema,
  clustersSchema,
  densitySchema,
  distPerResSchema,
  energiesSchema,
  fluctuationSchema,
  hbondsSchema,
  interactionsSchema,
  lipidInterSchema,
  lipidOrderSchema,
  memMapSchema,
  pairwiseSchema,
  pcaSchema,
  pocketsSchema,
  referenceGroupsSchema,
  rgyrSchema,
  rmsdPerResidueSchema,
  rmsdSchema,
  sasaSchema,
  thicknessSchema,
} from "./index";

const FIXTURES = join(process.cwd(), "src/mocks/fixtures/mdposit/analyses");
const load = (name: string): unknown => JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), "utf8"));

// Real payloads captured from MD-A007L3.1 (step 1.1).
const CAPTURED: [string, z.ZodType<unknown>][] = [
  ["rgyr", rgyrSchema],
  ["fluctuation", fluctuationSchema],
  ["rmsds", referenceGroupsSchema],
  ["tmscores", referenceGroupsSchema],
  ["rmsd-perres", rmsdPerResidueSchema],
  ["pca", pcaSchema],
  ["pockets", pocketsSchema],
  ["sasa", sasaSchema],
  ["clusters-00", clustersSchema],
  ["clusters-01", clustersSchema],
  ["energies-00", energiesSchema],
  ["rmsd-pairwise-00", pairwiseSchema],
  ["rmsd-pairwise-01", pairwiseSchema],
  ["dist-perres-00", distPerResSchema],
  ["hbonds-00", hbondsSchema],
  ["interactions", interactionsSchema],
];

describe("captured fixtures", () => {
  it.each(CAPTURED)("%s parses", (fixture, schema) => {
    const result = parseWith(schema, load(fixture));
    expect(result.ok, result.ok ? "" : `${result.issue.path}: ${result.issue.message}`).toBe(true);
  });

  it("counts pca components from the projection rows and keeps pockets start/step", () => {
    const pca = parseWith(pcaSchema, load("pca"));
    if (!pca.ok) throw new Error(pca.issue.message);
    expect(pca.data.components).toBe(pca.data.projections.length);
    const pockets = parseWith(pocketsSchema, load("pockets"));
    if (!pockets.ok) throw new Error(pockets.issue.message);
    expect(pockets.data.step).toBe(251);
  });

  it("derives sasa totals once", () => {
    const result = parseWith(sasaSchema, load("sasa"));
    if (!result.ok) throw new Error(result.issue.message);
    expect(result.data.total.length).toBe(result.data.perResidue[0]!.length);
  });
});

describe("statistical series", () => {
  it("keeps backend stats and defaults start/step", () => {
    const payload = { y: { rmsd: { average: 1, stddev: 0.5, min: 0, max: 2, data: [0, 1, 2] } } };
    expect(parseWith(rmsdSchema, payload)).toMatchObject({
      ok: true,
      data: { start: 0, step: 1, series: [{ key: "rmsd", stats: { mean: 1, std: 0.5, count: 3 } }] },
    });
  });

  it("recomputes missing stats from the samples (population std)", () => {
    const result = parseWith(rmsdSchema, { step: 2, y: { rmsd: { data: [1, 3] } } });
    expect(result).toMatchObject({ ok: true, data: { step: 2, series: [{ stats: { mean: 2, std: 1, min: 1, max: 3 } }] } });
  });

  it("requires every rgyr component", () => {
    expect(parseWith(rgyrSchema, { y: { rgyr: { data: [1] } } }).ok).toBe(false);
  });
});

describe("legacy shapes", () => {
  it("accepts the rmsd-perres matrix form", () => {
    const result = parseWith(rmsdPerResidueSchema, { rmsdpr: [[1, 2], [3, 4]] });
    expect(result).toMatchObject({ ok: true, data: { residues: [{ name: "Residue 1" }, { name: "Residue 2" }] } });
  });

  it("accepts a legacy single pairwise matrix and a nested pca", () => {
    expect(parseWith(pairwiseSchema, { rmsds: [[0, 1], [1, 0]] })).toMatchObject({
      ok: true,
      data: { start: 0, step: 1, matrices: [{ name: "Overall" }] },
    });
    expect(parseWith(pcaSchema, { data: { eigenvalues: [1, 2], projections: [[1, 2], [3, 4]] } })).toMatchObject({
      ok: true,
      data: { components: 2 },
    });
  });

  it("keeps null as NaN in dist-perres and normalises bare entries", () => {
    const result = parseWith(distPerResSchema, { means: [[1, null]] });
    if (!result.ok) throw new Error(result.issue.message);
    expect(result.data.data[0]!.means![0]![1]).toBeNaN();
  });

  it("derives occupancy from flag rows (legacy) and keeps live fractions", () => {
    const result = parseWith(hbondsSchema, { data: [{ name: "a", hbonds_timed: [[1, 0, 1]] }] });
    if (!result.ok) throw new Error(result.issue.message);
    expect([...result.data.interactions[0]!.timed[0]!]).toEqual([1, 0, 1]);
    expect(result.data.interactions[0]!.occupancy[0]).toBeCloseTo(2 / 3);
  });

  it("requires both agents on interactions", () => {
    expect(parseWith(interactionsSchema, { name: "x" }).ok).toBe(false);
    expect(parseWith(interactionsSchema, { name: "x", agent_1: "a", agent_2: "b" }).ok).toBe(true);
  });

  it("trims energy arrays to a common length", () => {
    const agent = { labels: ["a", "b", "c"], es: [1, 2], vdw: [1, 2, 3], both: [1, 2, 3] };
    const result = parseWith(energiesSchema, { data: [{ name: "n", agent1: agent, agent2: {} }] });
    if (!result.ok) throw new Error(result.issue.message);
    expect(result.data.data[0]!.agent1.labels).toHaveLength(2);
    expect(result.data.data[0]!.agent2.labels).toHaveLength(0);
  });
});

// No captured payload for the membrane analyses yet (stage 7): shapes are built from the old types.
describe("membrane shapes (synthetic)", () => {
  it("apl accepts scalar and array median/std", () => {
    const base = { "upper leaflet": [[1, 2]], grid_x: [0, 1], grid_y: [0] };
    expect(parseWith(aplSchema, { data: { ...base, median: 3, std: 1 } })).toMatchObject({
      ok: true,
      data: { median: [3], std: [1] },
    });
    expect(parseWith(aplSchema, { data: { ...base, median: [3, 4], std: [1, 1] } })).toMatchObject({
      ok: true,
      data: { median: [3, 4] },
    });
    expect(parseWith(aplSchema, { data: { median: 3, std: 1 } }).ok).toBe(false);
  });

  it("mem-map sorts membrane ids numerically", () => {
    const mem = { leaflets: { top: [1], bot: [2] }, polar_atoms: { top: [], bot: [] } };
    const result = parseWith(memMapSchema, { mems: { "10": mem, "2": mem }, no_mem_lipid: [] });
    expect(result).toMatchObject({ ok: true, data: { ids: ["2", "10"] } });
  });

  it("lipid-inter fits lipid columns to the residue count", () => {
    const result = parseWith(lipidInterSchema, { data: { residue_indices: [1, 2, 3], KEY: [5] } });
    if (!result.ok) throw new Error(result.issue.message);
    expect(result.data.lipids[0]!.values).toHaveLength(3);
    expect(result.data.lipids[0]!.values[1]).toBeNaN();
  });

  it("thickness fills frame and step", () => {
    expect(parseWith(thicknessSchema, { data: { thickness: [1, 2] } })).toMatchObject({
      ok: true,
      data: { step: 1, frame: [0, 1] },
    });
  });

  it("density needs a metric per component; lipid-order needs a lipid", () => {
    expect(parseWith(densitySchema, { data: { z: [0], comps: [{ name: "w" }] } }).ok).toBe(false);
    expect(parseWith(densitySchema, { data: { z: [0], comps: [{ name: "w", mass: { dens: [1] } }] } }).ok).toBe(true);
    expect(parseWith(lipidOrderSchema, { data: {} }).ok).toBe(false);
    expect(parseWith(lipidOrderSchema, { data: { POPC: { sn1: { avg: [0.1] } } } }).ok).toBe(true);
  });
});
