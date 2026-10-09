import { describe, expect, it } from "vitest";
import { completeDraft, productionRun } from "@/test/depositionFixtures";
import { computeCompleteness, firstIncompleteStep } from "./completeness";
import { emptyDraft } from "./draft";
import { publishSchema } from "./schema.publish";
import { RUN_SECTIONS, STUDY_SECTIONS, SYSTEM_SECTIONS, ghostSections } from "./sections";
import type { DepositionDraft } from "./types";

const step = (draft: DepositionDraft, id: string) => {
  const found = computeCompleteness(draft).steps.find((entry) => entry.id === id);
  if (!found) throw new Error(`no step ${id}`);
  return found;
};

describe("computeCompleteness", () => {
  it("an empty draft is 0 percent with every step todo (U2)", () => {
    const result = computeCompleteness(emptyDraft());
    expect(result.completion).toBe(0);
    expect(result.ready).toBe(false);
    expect(result.steps.map((entry) => entry.status)).toEqual(["todo", "todo", "todo"]);
    // study 6 (title, description, authors, community, access, license), system 7, experiments 1 (add a run)
    expect(result.steps.map((entry) => entry.requiredLeft)).toEqual([6, 7, 1]);
    expect(result.requiredLeft).toBe(14);
    expect(firstIncompleteStep(result)).toBe("study");
  });

  it("a complete draft is ready, 100 percent and lands on review", () => {
    const result = computeCompleteness(completeDraft());
    expect(result).toMatchObject({ requiredLeft: 0, toFix: 0, completion: 100, ready: true, missing: [], fixes: [] });
    expect(result.steps.map((entry) => entry.status)).toEqual(["done", "done", "done"]);
    expect(firstIncompleteStep(result)).toBe("review");
  });

  it("counts optional fields per section and drops them once filled", () => {
    const draft = completeDraft();
    expect(step(draft, "study").optionalLeft).toBe(5);
    draft.study.doi = "10.1234/abc";
    draft.study.keywords = ["lysozyme"];
    expect(step(draft, "study").optionalLeft).toBe(3);
    const basics = step(draft, "study").sections.find((section) => section.id === "basics");
    expect(basics).toMatchObject({ status: "done", optionalLeft: 0, optionalTotal: 2 });
  });

  it("a section with something filled but a required field open is partial", () => {
    const draft = emptyDraft();
    draft.study.title = "Only a title";
    const basics = step(draft, "study").sections.find((section) => section.id === "basics");
    expect(basics).toMatchObject({ status: "partial", requiredLeft: 1 });
    expect(step(draft, "study").status).toBe("partial");
  });

  describe("conditional rules", () => {
    it("embargo date is required only when access is embargoed", () => {
      const draft = completeDraft();
      expect(step(draft, "study").requiredLeft).toBe(0);
      draft.study.access = "embargoed";
      expect(step(draft, "study").requiredLeft).toBe(1);
      draft.study.embargo = { until: "2999-01-01" };
      expect(step(draft, "study").requiredLeft).toBe(0);
    });

    it("an embargo date in the past is a format problem, not a missing field", () => {
      const draft = completeDraft();
      draft.study.access = "embargoed";
      draft.study.embargo = { until: "2020-01-01" };
      const result = computeCompleteness(draft, { now: Date.parse("2026-09-30T12:00:00Z") });
      expect(result.toFix).toBe(1);
      expect(result.ready).toBe(false);
      expect(result.fixes[0]).toMatchObject({ code: "date_not_future", label: "Open on" });
      expect(result.steps[0]?.status).toBe("error");
    });

    it("box angles are required only for triclinic or custom boxes", () => {
      const draft = completeDraft();
      expect(step(draft, "system").requiredLeft).toBe(0);
      draft.system.box = { shape: "triclinic", a: 6.8, b: 7.1, c: 6.5 };
      expect(step(draft, "system").requiredLeft).toBe(1);
      draft.system.box = { ...draft.system.box, alpha: 90, beta: 104.2, gamma: 90 };
      expect(step(draft, "system").requiredLeft).toBe(0);
      // Switching back to a fixed shape keeps the angles in the draft but stops counting them.
      draft.system.box = { ...draft.system.box, shape: "cubic" };
      expect(step(draft, "system").requiredLeft).toBe(0);
    });

    it("box vectors need all three edge lengths", () => {
      const draft = completeDraft();
      draft.system.box = { shape: "cubic", a: 7, b: 7 };
      expect(computeCompleteness(draft).missing.map((ref) => ref.label)).toEqual(["Box vectors"]);
    });

    it("temperature and pressure appear only for the ensembles that use them", () => {
      const sectionIds = (run: ReturnType<typeof productionRun>) =>
        computeCompleteness({ ...completeDraft(), runs: [run] }).steps[2]?.runs[0]?.sections.map((section) => section.id);
      expect(sectionIds(productionRun())).toEqual(["files", "basics", "temperature", "pressure"]);
      expect(sectionIds(productionRun({ ensemble: "NVT" }))).toEqual(["files", "basics", "temperature"]);
      expect(sectionIds(productionRun({ ensemble: "NVE" }))).toEqual(["files", "basics"]);
    });

    it("NpT requires reference temperature and pressure", () => {
      const run = productionRun({ temperature: { thermostat: "v-rescale" }, pressure: undefined });
      const result = computeCompleteness({ ...completeDraft(), runs: [run] });
      expect(result.missing.map((ref) => ref.label)).toEqual(["Reference temperature", "Barostat", "Reference pressure"]);
    });

    it("a run without a type shows only files and Basics, owing files and type (195:2572)", () => {
      const run = { id: "run-new", name: "Production", fileKeys: [] };
      const result = computeCompleteness({ ...completeDraft(), runs: [run] });
      const view = result.steps[2]?.runs[0];
      expect(view?.sections.map((section) => section.id)).toEqual(["files", "basics"]);
      expect(view?.requiredLeft).toBe(2);
      expect(view?.status).toBe("partial");
    });

    it("energy minimization needs neither ensemble, time step, temperature nor pressure", () => {
      const run = { id: "run-min", name: "Minimization", simulationType: "energy_minimization" as const, length: 50_000, fileKeys: ["min.tpr"] };
      const result = computeCompleteness({ ...completeDraft(), runs: [run] });
      expect(result.steps[2]).toMatchObject({ requiredLeft: 0, status: "done" });
    });

    it("ghost sections count only after they are added", () => {
      const run = productionRun();
      expect(ghostSections(run).map((section) => section.id)).toEqual([
        "electrostatics",
        "vanDerWaals",
        "constraints",
        "enhancedSampling",
        "freeEnergy",
        "motionRemoval",
      ]);
      const before = computeCompleteness({ ...completeDraft(), runs: [run] }).steps[2];
      const added = { ...run, electrostatics: {} };
      const after = computeCompleteness({ ...completeDraft(), runs: [added] }).steps[2];
      expect((after?.optionalLeft ?? 0) - (before?.optionalLeft ?? 0)).toBe(2);
      expect(ghostSections(added).map((section) => section.id)).not.toContain("electrostatics");
      expect(ghostSections({ id: "x", fileKeys: [] })).toEqual([]);
    });
  });

  describe("experiments step", () => {
    it("sums the runs and lists their missing fields with a location (226:5484)", () => {
      const draft = completeDraft();
      draft.runs = [productionRun(), productionRun({ id: "run-2", name: "Production replica 3", length: undefined, fileKeys: [] })];
      const result = computeCompleteness(draft);
      expect(result.steps[2]).toMatchObject({ requiredLeft: 2, status: "partial" });
      expect(result.missing.map((ref) => `${ref.label} @ ${ref.location}`)).toEqual([
        "Experiment files @ Experiments - Production replica 3",
        "Length @ Experiments - Production replica 3",
      ]);
      expect(result.steps[2]?.runs.map((run) => run.requiredLeft)).toEqual([0, 2]);
    });

    it("names unnamed runs in the location and flags duplicate names", () => {
      const draft = completeDraft();
      draft.runs = [productionRun({ name: undefined }), productionRun({ id: "run-2" }), productionRun({ id: "run-3" })];
      const result = computeCompleteness(draft);
      expect(result.missing[0]?.location).toBe("Experiments - Unnamed run");
      expect(result.fixes).toEqual([expect.objectContaining({ code: "duplicate_name", runId: "run-3" })]);
    });
  });

  it("format problems make a section error and block ready", () => {
    const draft = completeDraft();
    draft.study.doi = "10.12";
    draft.study.authors = [{ kind: "person", givenName: "Jana", orcid: "1234", affiliations: [] }];
    const result = computeCompleteness(draft);
    expect(result.toFix).toBe(2);
    expect(result.ready).toBe(false);
    expect(result.steps[0]?.status).toBe("error");
    expect(result.fixes.map((ref) => ref.code)).toEqual(["invalid_doi", "invalid_orcid"]);
  });

  it("registry ids are unique and every field path is non-empty", () => {
    for (const sections of [STUDY_SECTIONS, SYSTEM_SECTIONS, RUN_SECTIONS]) {
      expect(new Set(sections.map((section) => section.id)).size).toBe(sections.length);
      for (const section of sections) {
        expect(section.fields.length).toBeGreaterThan(0);
        for (const field of section.fields) expect(field.path).not.toBe("");
      }
    }
  });
});

describe("publishSchema", () => {
  it("accepts exactly the drafts that computeCompleteness calls ready", () => {
    const cases: DepositionDraft[] = [emptyDraft(), completeDraft()];
    const broken = completeDraft();
    broken.study.title = "";
    cases.push(broken);
    const noRuns = completeDraft();
    noRuns.runs = [];
    cases.push(noRuns);
    const angles = completeDraft();
    angles.system.box = { shape: "triclinic", a: 1, b: 1, c: 1 };
    cases.push(angles);
    for (const draft of cases) {
      expect(publishSchema.safeParse(draft).success).toBe(computeCompleteness(draft).ready);
    }
  });

  it("reports one issue per missing field with a draft path", () => {
    const draft = completeDraft();
    draft.study.title = undefined;
    draft.runs = [productionRun({ fileKeys: [] })];
    const result = publishSchema.safeParse(draft);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => `${issue.path.join(".")}:${issue.message}`)).toEqual([
      "study.title:required",
      "runs.0.fileKeys:required",
    ]);
  });
});
