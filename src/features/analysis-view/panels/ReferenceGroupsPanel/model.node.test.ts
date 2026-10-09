import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseWith, referenceGroupsSchema, type ReferenceGroupsData } from "@/entities/analysis";
import { buildReferenceGroupsModel, effectiveReference, readConfig } from "./model";

const FIXTURES = join(process.cwd(), "src/mocks/fixtures/mdposit/analyses");
const load = (name: string): ReferenceGroupsData => {
  const result = parseWith(referenceGroupsSchema, JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), "utf8")));
  if (!result.ok) throw new Error(result.issue.message);
  return result.data;
};

describe("ReferenceGroupsPanel model", () => {
  it("shows one series per group of the first reference by default (rmsds, with massw entries)", () => {
    const data = load("rmsds");
    const model = buildReferenceGroupsModel(data, null, readConfig({ title: "RMSD by reference", quantity: "RMSD" }), "rmsds");
    expect(model.reference).toBe("firstframe");
    expect(model.lines.map((line) => line.name)).toEqual(["protein", "other"]);
    expect(model.lines[0]!.data[1]![0]).toBe(data.start + data.step);
    expect(model.yAxis).toMatchObject({ scale: true });
  });

  it("derives the effective reference from the data, with no stored repair", () => {
    const data = load("rmsds");
    expect(effectiveReference(data.references, "average")).toBe("average");
    expect(effectiveReference(data.references, "gone")).toBe("firstframe");
    expect(effectiveReference([], "average")).toBeNull();
  });

  it("fixes the tmscores y axis to [0, 1]", () => {
    const model = buildReferenceGroupsModel(
      load("tmscores"),
      "average",
      readConfig({
        title: "TM-score",
        quantity: "TM-score",
        yRange: { min: 0, max: 1 },
      }),
      "tmscores",
    );
    expect(model.reference).toBe("average");
    expect(model.yAxis).toMatchObject({ min: 0, max: 1 });
    expect(model.emptyReason).toBeNull();
  });

  it("reports the empty reason for a reference without values", () => {
    const model = buildReferenceGroupsModel(
      {
        start: 0,
        step: 1,
        references: ["a"],
        data: [{ reference: "a", group: "g", values: [] }],
      },
      null,
      readConfig(undefined),
      "rmsds",
    );
    expect(model.emptyReason).toBe("No data for this reference");
    expect(model.rows[0]!.stats).toBeNull();
  });
});
