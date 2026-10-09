import { describe, expect, it } from "vitest";
import { emptyDraft, sanitizeDraft } from "@/entities/deposition";
import { figmaDraftMetadata } from "@/mocks/fixtures";
import { completeDraft, productionRun } from "@/test/depositionFixtures";
import { fromExperimentMetadata, toExperimentMetadata } from "./mapper";

describe("draft mapper", () => {
  it("round-trips a complete draft losslessly", () => {
    const draft = completeDraft();
    draft.study.doi = "10.1234/mdrepo.abc";
    draft.study.keywords = ["lysozyme"];
    draft.study.access = "embargoed";
    draft.study.embargo = { until: "2999-01-01", reason: "Paper" };
    draft.study.funding = [{ funderName: "Czech Science Foundation", awardNumber: "GA24-10000S" }];
    draft.study.authors = [
      { kind: "person", givenName: "Jana", familyName: "Novakova", orcid: "0000-0002-1825-0097", affiliations: [{ name: "Masaryk University", rorId: "https://ror.org/02j46qs45" }] },
      { kind: "organization", name: "Brno Consortium", affiliations: [] },
    ];
    draft.system.molecules = [{ type: "ions", name: "Ions", count: 14, concentrationMM: 150, ions: [{ name: "Na", charge: 1, count: 8 }] }];
    draft.system.fieldSources = { "system.forceField": "topol.top" };
    draft.runs = [
      productionRun({ outputInterval: 10, electrostatics: { method: "PME", cutoffNm: 1.2 }, freeEnergy: {} }),
      { id: "run-min", name: "Minimization", simulationType: "energy_minimization", length: 50_000, fileKeys: ["min.tpr"] },
    ];
    expect(fromExperimentMetadata(toExperimentMetadata(draft))).toEqual(draft);
  });

  it("writes the proposed wire names and drops empty values", () => {
    const wire = toExperimentMetadata({ ...emptyDraft(), runs: [productionRun()], study: { ...emptyDraft().study, title: "T", communityId: "c1" } });
    expect(wire).toMatchObject({
      study: { title: "T", community_ids: ["c1"] },
      runs: [{ simulation_type: "molecular_dynamics", length_ns: 100, time_step_fs: 2, temperature: { reference_K: 310, coupling: "v-rescale" }, pressure: { reference_bar: 1 } }],
    });
    expect(JSON.stringify(wire)).not.toContain("null");
    expect(wire["study"]).not.toHaveProperty("doi");
  });

  it("stores minimization length as steps", () => {
    const wire = toExperimentMetadata({ ...emptyDraft(), runs: [{ id: "r", simulationType: "energy_minimization", length: 5000, fileKeys: [] }] });
    expect((wire["runs"] as Record<string, unknown>[])[0]).toMatchObject({ length_steps: 5000 });
    expect((wire["runs"] as Record<string, unknown>[])[0]).not.toHaveProperty("length_ns");
  });

  it("reads the mock backend's metadata and treats null as absent", () => {
    const draft = fromExperimentMetadata(figmaDraftMetadata);
    expect(draft.study.title).toBe("Lysozyme in water");
    expect(draft.study.authors[0]).toMatchObject({ givenName: "Jana", familyName: "Novakova" });
    expect(draft.system.engine).toEqual({ name: "GROMACS", version: "2024.1" });
    const withNulls = fromExperimentMetadata({ study: { title: null, doi: null, authors: [{ orcid: null, given_name: "A" }] }, runs: [{ id: "r", ensemble: null }] });
    expect(withNulls.study.authors[0]).toMatchObject({ givenName: "A" });
    expect(withNulls.runs[0]).toEqual({ id: "r", fileKeys: [] });
  });

  it("copes with empty, foreign and partly invalid metadata", () => {
    expect(fromExperimentMetadata({})).toEqual(emptyDraft());
    expect(fromExperimentMetadata(null)).toEqual(emptyDraft());
    expect(fromExperimentMetadata("x")).toEqual(emptyDraft());
    const partly = fromExperimentMetadata({ study: { title: "Keep", access: "closed", doi: "bad" }, runs: [{ id: "r", simulation_type: "production", ensemble: "NpT" }] });
    expect(partly.study).toMatchObject({ title: "Keep" });
    expect(partly.study.access).toBeUndefined();
    expect(partly.study.doi).toBeUndefined();
    expect(partly.runs[0]).toMatchObject({ id: "r", ensemble: "NpT" });
    expect(partly.runs[0]?.simulationType).toBeUndefined();
    expect(sanitizeDraft(partly)).toEqual(partly);
  });
});
