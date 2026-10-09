import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { interactionsSchema, parseWith, type InteractionData } from "@/entities/analysis";
import { buildInteractionsModel, classMatrix, countText, interactionsTooltip, sidesOf } from "./model";

const FIXTURES = join(process.cwd(), "src/mocks/fixtures/mdposit/analyses");
const load = (): InteractionData[] => {
  const result = parseWith(interactionsSchema, JSON.parse(readFileSync(join(FIXTURES, "interactions.json"), "utf8")));
  if (!result.ok) throw new Error(result.issue.message);
  return result.data;
};

const residues = (n1: number, n2: number): InteractionData => ({
  name: "r",
  agent_1: "protein",
  agent_2: "ligand",
  residue_indices_1: Array.from({ length: n1 }, (_, i) => i),
  residue_indices_2: Array.from({ length: n2 }, (_, i) => i),
  interface_indices_1: [0, 1],
  interface_indices_2: [1],
});

describe("InteractionsPanel model", () => {
  it("falls back to atoms for the live payload and uses the categorical scale below 256 per side", () => {
    const model = buildInteractionsModel(load(), null);
    expect(model.level).toBe("atom");
    expect(model.categorical).toBe(true);
    expect(model.scale).toMatchObject({ kind: "categorical" });
    expect(model.scale.kind === "categorical" && model.scale.classes).toHaveLength(4);
    expect(model.matrix).toMatchObject({ rows: 50, cols: 200 });
    expect(model.sides![0].agent).toBe("protein");
  });

  it("builds class values with agent 1 on the columns and agent 2 on the rows", () => {
    const sides = sidesOf(residues(3, 2))!;
    const rows = classMatrix(sides.first, sides.second);
    expect(Array.from(rows[0]!)).toEqual([2, 2, 0]);
    expect(Array.from(rows[1]!)).toEqual([3, 3, 1]);
  });

  it("switches to a continuous scale with an explicit note when binning is needed", () => {
    const model = buildInteractionsModel([residues(300, 10)], null);
    expect(model.categorical).toBe(false);
    expect(model.scale).toMatchObject({ kind: "continuous", min: 0, max: 3 });
    expect(model.note).toContain("mean class");
    expect(model.matrix).toMatchObject({ rows: 10, cols: 150, colStride: 2 });
  });

  it("pluralises correctly and never prints indexs", () => {
    expect(countText(1, "residue")).toBe("1 residue");
    expect(countText(5, "atom")).toBe("5 atoms");
    const model = buildInteractionsModel(load(), null);
    expect(model.summary).not.toContain("indexs");
    expect(model.summary).toContain("200 atoms");
    expect(model.sides![0].hidden).toBe(200 - 15);
  });

  it("names the class in the tooltip and explains missing lists", () => {
    const model = buildInteractionsModel([residues(3, 2)], null);
    expect(interactionsTooltip(model)({ row: 1, col: 0, value: 3 })[2]).toEqual({ label: "Class", value: "Both" });
    const bare = buildInteractionsModel([{ name: "n", agent_1: "a", agent_2: "b" }], "4");
    expect(bare.selectedId).toBe("0");
    expect(bare.emptyReason).toContain("were not provided");
    expect(buildInteractionsModel([], null).emptyReason).toBe("No interaction data in this analysis");
  });
});
