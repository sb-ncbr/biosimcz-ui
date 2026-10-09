import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseWith, rmsdPerResidueSchema } from "@/entities/analysis";
import { buildRmsdPerResidueModel, effectiveResidue } from "./model";

const raw: unknown = JSON.parse(readFileSync(join(process.cwd(), "src/mocks/fixtures/mdposit/analyses/rmsd-perres.json"), "utf8"));
const parsed = parseWith(rmsdPerResidueSchema, raw);
if (!parsed.ok) throw new Error(parsed.issue.message);
const data = parsed.data;

describe("RmsdPerResiduePanel model", () => {
  it("selects the first residue by default and scales x by step", () => {
    const model = buildRmsdPerResidueModel(data, null, "rmsd-perres");
    expect(model.index).toBe(0);
    expect(model.name).toBe("Residue 1");
    expect(model.lines[0]!.data[1]![0]).toBe(data.step);
    expect(model.stats?.count).toBe(data.residues[0]!.values.length);
  });

  it("derives a valid index from an out-of-range selection", () => {
    expect(effectiveResidue(5, 9)).toBe(0);
    expect(effectiveResidue(5, 3)).toBe(3);
    expect(effectiveResidue(0, 3)).toBeNull();
  });

  it("returns the empty text when there are no residues", () => {
    const model = buildRmsdPerResidueModel({ step: 1, residues: [] }, null, "rmsd-perres");
    expect(model.emptyReason).toBe("No RMSD per residue data available.");
    expect(model.lines).toEqual([]);
  });
});
