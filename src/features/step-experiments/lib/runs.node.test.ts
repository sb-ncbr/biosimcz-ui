import { describe, expect, it } from "vitest";
import { computeCompleteness, emptyDraft, emptyRun, type DepositionDraft, type Run } from "@/entities/deposition";
import { cellText, createRun, duplicateRun, hiddenWithValues, insertAfter, moveRun, summarizeRun, uniqueName } from "./runs";

const run = (id: string, rest: Partial<Run> = {}): Run => ({ ...emptyRun(id), ...rest });

describe("run names", () => {
  it("numbers a default name when it is taken, ignoring case", () => {
    const runs = [run("a", { name: "Molecular dynamics" }), run("b", { name: "molecular dynamics 2" })];
    expect(uniqueName(runs, "Molecular dynamics")).toBe("Molecular dynamics 3");
    expect(uniqueName([], "Molecular dynamics")).toBe("Molecular dynamics");
  });

  it("creates a run with its type preset and a default name", () => {
    const created = createRun("free_energy", [], "r1");
    expect(created).toMatchObject({ id: "r1", name: "Free energy simulation", simulationType: "free_energy", fileKeys: [] });
  });

  it("duplicates settings but not files, with a unique copy name", () => {
    const source = run("a", { name: "Production", simulationType: "molecular_dynamics", ensemble: "NpT", fileKeys: ["md.tpr"] });
    const copy = duplicateRun(source, [source], "b");
    expect(copy).toMatchObject({ id: "b", name: "Production (copy)", ensemble: "NpT", fileKeys: [] });
    expect(duplicateRun(source, [source, copy], "c").name).toBe("Production (copy) 2");
  });
});

describe("run order", () => {
  const runs = [run("a"), run("b"), run("c")];

  it("inserts a copy right after its source", () => {
    expect(insertAfter(runs, "a", run("x")).map((r) => r.id)).toEqual(["a", "x", "b", "c"]);
  });

  it("moves a run by one and stops at the ends", () => {
    expect(moveRun(runs, "b", -1).map((r) => r.id)).toEqual(["b", "a", "c"]);
    expect(moveRun(runs, "b", 1).map((r) => r.id)).toEqual(["a", "c", "b"]);
    expect(moveRun(runs, "a", -1).map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(moveRun(runs, "c", 1).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});

describe("summarizeRun (186:1099 cells)", () => {
  it("shows steps for minimization and dashes for what does not apply", () => {
    const summary = summarizeRun(run("a", { simulationType: "energy_minimization", length: 50000 }));
    expect(cellText(summary.length)).toBe("50,000 steps");
    expect(summary.ensemble).toBeNull();
    expect(summary.temperature.kind).toBe("na");
    expect(summary.pressure.kind).toBe("na");
  });

  it("shows temperature and pressure by ensemble and marks empty required values as missing", () => {
    const nvt = summarizeRun(run("a", { simulationType: "molecular_dynamics", ensemble: "NVT", length: 0.1, temperature: { referenceK: 310 } }));
    expect(cellText(nvt.length)).toBe("0.1 ns");
    expect(cellText(nvt.temperature)).toBe("310 K");
    expect(nvt.pressure.kind).toBe("na");
    const npt = summarizeRun(run("b", { simulationType: "molecular_dynamics", ensemble: "NpT" }));
    expect(npt.length.kind).toBe("missing");
    expect(npt.pressure.kind).toBe("missing");
  });

  it("has nothing to show before a type is chosen", () => {
    const summary = summarizeRun(run("a"));
    expect(summary.typeLabel).toBeNull();
    expect(summary.length.kind).toBe("na");
  });
});

describe("hidden sections", () => {
  it("lists sections that hold values but no longer apply", () => {
    const nve = run("a", { simulationType: "molecular_dynamics", ensemble: "NVE", temperature: { referenceK: 300 } });
    expect(hiddenWithValues(nve)).toEqual(["Temperature"]);
    expect(hiddenWithValues(run("b", { simulationType: "molecular_dynamics", ensemble: "NpT", temperature: { referenceK: 300 } }))).toEqual([]);
  });
});

describe("ensemble-driven required rules (registry)", () => {
  const withRun = (value: Run): DepositionDraft => ({ ...emptyDraft(), runs: [value] });
  const missingPaths = (value: Run): string[] =>
    computeCompleteness(withRun(value)).missing.filter((ref) => ref.runId === value.id).map((ref) => ref.path);
  const base = { fileKeys: ["md.tpr"], name: "Run", simulationType: "molecular_dynamics" as const, length: 1, timeStep: 2 };

  it("free energy behaves like molecular dynamics", () => {
    expect(missingPaths(run("a", { ...base, simulationType: "free_energy" }))).toEqual(["ensemble"]);
  });

  it("NVE needs no thermostat or barostat, NVT needs only the thermostat, NpT needs both", () => {
    expect(missingPaths(run("a", { ...base, ensemble: "NVE" }))).toEqual([]);
    expect(missingPaths(run("b", { ...base, ensemble: "NVT" }))).toEqual(["temperature.thermostat", "temperature.referenceK"]);
    expect(missingPaths(run("c", { ...base, ensemble: "NpT" }))).toEqual([
      "temperature.thermostat",
      "temperature.referenceK",
      "pressure.barostat",
      "pressure.referenceBar",
    ]);
  });

  it("switching the ensemble back to NVE drops the requirement without deleting the values", () => {
    const filled = run("a", { ...base, ensemble: "NVE", temperature: { thermostat: "V-rescale", referenceK: 300 } });
    expect(missingPaths(filled)).toEqual([]);
    expect(filled.temperature?.referenceK).toBe(300);
  });
});
