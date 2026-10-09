import { describe, expect, it } from "vitest";
import { systemSchema } from "@/entities/deposition";
import { applyChanges, dropEditedSources, planPrefill } from "./prefill";

const empty = () => systemSchema.parse({});

describe("planPrefill", () => {
  it("fills empty fields and ignores unknown or invalid ones", () => {
    const plan = planPrefill(empty(), "topol.top", [
      { path: "system.forceField", value: "CHARMM36m" },
      { path: "system.box.a", value: 6.8 },
      { path: "system.box.b", value: -1 },
      { path: "runs.0.name", value: "x" },
    ]);
    expect(plan.fill.map((change) => change.path)).toEqual(["forceField", "box.a"]);
    expect(plan.keep).toEqual([]);
  });

  it("keeps a different user value and stays silent when the value is equal", () => {
    const system = systemSchema.parse({ forceField: "AMBER ff14SB", engine: { name: "GROMACS" } });
    const plan = planPrefill(system, "topol.top", [
      { path: "system.forceField", value: "CHARMM36m" },
      { path: "system.engine.name", value: "GROMACS" },
    ]);
    expect(plan.fill).toEqual([]);
    expect(plan.keep.map((change) => [change.path, change.current])).toEqual([["forceField", "AMBER ff14SB"]]);
  });
});

describe("applyChanges and dropEditedSources", () => {
  it("writes values with their source, and an edit removes the source", () => {
    const plan = planPrefill(empty(), "topol.top", [{ path: "system.forceField", value: "CHARMM36m" }]);
    const system = applyChanges(empty(), "topol.top", plan.fill);
    expect(system.forceField).toBe("CHARMM36m");
    expect(system.fieldSources).toEqual({ forceField: "topol.top" });
    expect(dropEditedSources(system, { forceField: "CHARMM36m" })).toEqual({ forceField: "topol.top" });
    expect(dropEditedSources(system, { forceField: "GAFF2" })).toEqual({});
  });
});
