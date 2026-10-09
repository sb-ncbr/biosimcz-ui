import { describe, expect, it } from "vitest";
import { computeCompleteness, emptyDraft } from "@/entities/deposition";
import { completeDraft, productionRun } from "@/test/depositionFixtures";
import type { SaveState } from "@/widgets/wizard-shell";
import { buildPublishModel, buildWizardNav } from "./nav";

const saved: SaveState = { kind: "saved", label: "Saved just now" };

describe("buildWizardNav", () => {
  it("an empty draft shows the fallback title, todo steps and no runs", () => {
    const draft = emptyDraft();
    const nav = buildWizardNav({ draftId: "draft-1", draft, completeness: computeCompleteness(draft), save: saved });
    expect(nav.draft.title).toBeNull();
    expect(nav.backHref).toBe("/depositions");
    expect(nav.steps.map((step) => [step.id, step.status, step.requiredLeft, step.href])).toEqual([
      ["study", "todo", 6, "/depositions/draft-1/study"],
      ["system", "todo", 7, "/depositions/draft-1/system"],
      ["experiments", "todo", 1, "/depositions/draft-1/experiments"],
    ]);
    expect(nav.steps[2]?.runs).toEqual([]);
    expect(nav.review).toEqual({ href: "/depositions/draft-1/review", ready: false });
  });

  it("lists runs with computed counts and encoded hrefs", () => {
    const draft = completeDraft();
    draft.study.title = " Lysozyme in water ";
    draft.runs = [productionRun(), productionRun({ id: "run-2", name: undefined, fileKeys: [] })];
    const nav = buildWizardNav({ draftId: "draft-1", draft, completeness: computeCompleteness(draft), save: saved });
    expect(nav.draft.title).toBe("Lysozyme in water");
    expect(nav.steps[2]?.runs?.map((run) => [run.label, run.requiredLeft, run.status, run.href])).toEqual([
      ["Production", 0, "done", "/depositions/draft-1/experiments/run-production"],
      ["Unnamed run", 2, "partial", "/depositions/draft-1/experiments/run-2"],
    ]);
    expect(nav.steps[2]?.requiredLeft).toBe(2);
  });

  it("marks the review item ready for a complete draft", () => {
    const draft = completeDraft();
    expect(buildWizardNav({ draftId: "d", draft, completeness: computeCompleteness(draft), save: saved }).review.ready).toBe(true);
  });
});

describe("buildPublishModel", () => {
  it("blocks while files failed or were interrupted", () => {
    const failed = buildPublishModel({ draftId: "draft-1", completeness: computeCompleteness(completeDraft()), save: saved, uploadsFailed: 2 });
    expect(failed).toEqual({ state: "blocked", reason: "2 files did not upload", blockedHref: "/depositions/draft-1/review" });
  });

  const model = (draft = emptyDraft(), save: SaveState = saved) => buildPublishModel({ draftId: "draft-1", completeness: computeCompleteness(draft), save });

  it("explains why Publish is blocked and where a click goes", () => {
    expect(model()).toEqual({ state: "blocked", reason: "Fill in 14 required fields to publish", blockedHref: "/depositions/draft-1/review" });
    const one = completeDraft();
    one.study.title = "";
    expect(model(one).reason).toBe("Fill in 1 required field to publish");
  });

  it("blocks on format errors and while offline, and is ready otherwise", () => {
    const bad = completeDraft();
    bad.study.doi = "10.12";
    expect(model(bad).reason).toBe("Fix 1 field to publish");
    // Offline: the click only explains itself, there is nothing to show on Review.
    expect(model(completeDraft(), { kind: "offline" })).toEqual({ state: "blocked", reason: "You are offline" });
    expect(model(completeDraft())).toEqual({ state: "ready" });
  });

  it("blocks while uploads are in flight (read from the layout-level uploads provider)", () => {
    const blocked = buildPublishModel({ draftId: "draft-1", completeness: computeCompleteness(completeDraft()), save: saved, uploadsInFlight: true });
    expect(blocked).toEqual({ state: "blocked", reason: "Wait for file uploads to finish", blockedHref: "/depositions/draft-1/review" });
  });
});
