import { describe, expect, it } from "vitest";
import { ANALYSIS_BASES, baseOf, groupAnalyses, isAnalysisName, labelOf } from "./names";
import { ANALYSIS_UNITS } from "./units";

describe("baseOf", () => {
  it.each([
    ["rmsd-pairwise-00", "rmsd-pairwise"],
    ["rmsd-pairwise-interface", "rmsd-pairwise-interface"],
    ["dist-perres-mean", "dist-perres-mean"],
    ["dist-perres-12", "dist-perres"],
    ["rmsd", "rmsd"],
  ])("%s -> %s", (name, base) => expect(baseOf(name)).toBe(base));
});

describe("labelOf", () => {
  it("labels bases, variants and the interface special case", () => {
    expect(labelOf("rmsd-pairwise")).toBe("RMSD Pairwise");
    expect(labelOf("rmsd-pairwise-00")).toBe("RMSD Pairwise - 00");
    expect(labelOf("rmsd-pairwise-interface")).toBe("RMSD Pairwise (Interface)");
    expect(labelOf("dist-perres-mean")).toBe("Distance per Residue (Mean)");
  });

  it("falls back to Title Case for unknown names", () => {
    expect(labelOf("foo-bar")).toBe("Foo Bar");
    expect(labelOf("foo-bar-03")).toBe("Foo Bar - 03");
  });
});

describe("isAnalysisName", () => {
  it("accepts known bases and variants, rejects the rest", () => {
    expect(isAnalysisName("hbonds-01")).toBe(true);
    expect(isAnalysisName("dist-perres-stdv")).toBe(true);
    expect(isAnalysisName("unknown")).toBe(false);
    expect(isAnalysisName("../rmsd")).toBe(false);
    expect(isAnalysisName("RMSD")).toBe(false);
    expect(isAnalysisName("")).toBe(false);
  });
});

describe("groupAnalyses", () => {
  it("keeps first-seen order and folds variants under the base", () => {
    const groups = groupAnalyses(["rmsd", "clusters-00", "pca", "clusters-01"]);
    expect(groups.map((group) => group.baseId)).toEqual(["rmsd", "clusters", "pca"]);
    expect(groups[1]).toMatchObject({ variants: ["clusters-00", "clusters-01"], hasVariants: true });
    expect(groups[0]).toMatchObject({ variants: ["rmsd"], hasVariants: false });
  });

  it("keeps the bare base next to its variants", () => {
    const [group] = groupAnalyses(["hbonds", "hbonds-00"]);
    expect(group).toMatchObject({ variants: ["hbonds", "hbonds-00"], hasVariants: true });
  });

  it("handles empty input and duplicates", () => {
    expect(groupAnalyses(undefined)).toEqual([]);
    expect(groupAnalyses(["pca", "pca"])[0]!.variants).toEqual(["pca"]);
  });
});

describe("units", () => {
  it("covers every base and marks units as unconfirmed", () => {
    for (const base of ANALYSIS_BASES) expect(ANALYSIS_UNITS[base]).toBeDefined();
    expect(ANALYSIS_UNITS.rmsd.y).toEqual({ text: "nm", confirmed: false });
    expect(ANALYSIS_UNITS.pca.y).toBeUndefined();
  });
});
