import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ANALYSIS_BASES } from "@/entities/analysis";
import { analysisFixture } from "@/mocks/fixtures/mdposit";
import { resolveRenderer } from "./index";

const FIXTURE_DIR = join(process.cwd(), "src/mocks/fixtures/mdposit/analyses");

const fixtureNames = (dir: string): string[] =>
  readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.replace(/\.json$/, ""));

// The bare base files (clusters, energies, ...) are option lists served by the options handler, not analysis data.
const OPTION_LISTS = new Set(["clusters", "dist-perres", "energies", "hbonds", "rmsd-pairwise"]);

const dataFixtureNames = [...fixtureNames(FIXTURE_DIR), ...fixtureNames(join(FIXTURE_DIR, "synthetic"))].filter((name) => !OPTION_LISTS.has(name));

describe("analysis registry", () => {
  it.each(ANALYSIS_BASES)("resolves %s to a renderer", (base) => {
    const resolved = resolveRenderer(base);
    expect(resolved).not.toBeNull();
    expect(resolved?.base).toBe(base);
    expect(resolved?.entry.bases).toContain(base);
  });

  it.each(["dist-perres-mean", "dist-perres-stdv", "dist-perres-mean-00", "dist-perres-stdv-01"])("resolves the per-residue name %s", (name) => {
    expect(resolveRenderer(name)).not.toBeNull();
  });

  it("does not resolve unknown names", () => {
    expect(resolveRenderer("no-such-analysis")).toBeNull();
  });

  it("keeps rmsd-pairwise-interface out of the rmsd-pairwise row", () => {
    expect(resolveRenderer("rmsd-pairwise-interface")?.base).toBe("rmsd-pairwise-interface");
    expect(resolveRenderer("rmsd-pairwise-00")?.base).toBe("rmsd-pairwise");
  });

  it("finds a fixture for every data file on disk", () => {
    expect(dataFixtureNames.length).toBeGreaterThanOrEqual(24);
    for (const name of dataFixtureNames) expect(analysisFixture(name), name).toBeDefined();
  });

  it.each(dataFixtureNames)("parses the %s fixture with its registry schema", (name) => {
    const resolved = resolveRenderer(name);
    expect(resolved, `renderer for ${name}`).not.toBeNull();
    const result = resolved!.entry.parse(analysisFixture(name));
    expect(result.ok, result.ok ? "" : `${name}: ${result.issue.path}: ${result.issue.message}`).toBe(true);
  });
});
