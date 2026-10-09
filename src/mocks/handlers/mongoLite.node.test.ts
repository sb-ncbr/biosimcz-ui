import { describe, expect, it } from "vitest";
import { matches, UnsupportedFilter } from "./mongoLite";

const doc = { metadata: { PROGRAM: "GROMACS", FF: ["Amber ff14SB", "GAFF"], TEMP: 300, SYSTATS: 5000, AUTHORS: ["Jana Novakova"], WAT: null } };

describe("mongoLite", () => {
  it("evaluates $in on scalars and arrays", () => {
    expect(matches(doc, { "metadata.PROGRAM": { $in: ["GROMACS", "NAMD"] } })).toBe(true);
    expect(matches(doc, { "metadata.PROGRAM": { $in: ["NAMD"] } })).toBe(false);
    expect(matches(doc, { "metadata.FF": { $in: ["GAFF"] } })).toBe(true);
    expect(matches(doc, { "metadata.TEMP": { $in: [300] } })).toBe(true);
    expect(matches(doc, { "metadata.TEMP": { $in: ["300"] } })).toBe(false);
  });

  it("evaluates $gte and a case-insensitive $regex", () => {
    expect(matches(doc, { "metadata.SYSTATS": { $gte: 5000 } })).toBe(true);
    expect(matches(doc, { "metadata.SYSTATS": { $gte: 5001 } })).toBe(false);
    expect(matches(doc, { "metadata.AUTHORS": { $regex: "novak", $options: "i" } })).toBe(true);
    expect(matches(doc, { "metadata.AUTHORS": { $regex: "novak", $options: "i" } })).toBe(true);
    expect(matches(doc, { "metadata.AUTHORS": { $regex: "x+", $options: "i" } })).toBe(false);
  });

  it("evaluates $and and treats null as missing", () => {
    expect(matches(doc, { $and: [{ "metadata.PROGRAM": { $in: ["GROMACS"] } }, { "metadata.SYSTATS": { $gte: 1 } }] })).toBe(true);
    expect(matches(doc, { $and: [{ "metadata.PROGRAM": { $in: ["GROMACS"] } }, { "metadata.SYSTATS": { $gte: 9999 } }] })).toBe(false);
    expect(matches(doc, { "metadata.WAT": { $in: ["TIP3P"] } })).toBe(false);
  });

  it.each([
    { $where: "1" },
    { "metadata.PROGRAM": { $ne: null } },
    { "metadata.PROGRAM": "GROMACS" },
    { "metadata.PROGRAM": { $in: ["a"], $nin: ["b"] } },
    { "metadata.AUTHORS": { $regex: "a", $options: "s" } },
    { "metadata.AUTHORS": { $regex: "a" } },
    { $or: [] },
    { $and: {} },
    [],
  ])("rejects anything outside the grammar: %j", (filter) => {
    expect(() => matches(doc, filter)).toThrow(UnsupportedFilter);
  });
});
