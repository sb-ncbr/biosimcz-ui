import { describe, expect, it } from "vitest";
import { completeDraft } from "@/test/depositionFixtures";
import { emptyDraft, sanitizeDraft } from "./draft";
import { draftSchema, isValidIsoDate, isValidOrcid } from "./schema.draft";

const issueMessages = (input: unknown): string[] => {
  const result = draftSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join(".")}:${issue.message}`);
};

describe("draft schema (lenient)", () => {
  it("accepts an empty object and fills the list defaults", () => {
    expect(draftSchema.parse({})).toEqual({
      study: { keywords: [], authors: [], contributors: [], funding: [], relatedWorks: [] },
      system: { molecules: [], fieldSources: {}, fileKeys: [] },
      runs: [],
    });
    expect(emptyDraft().runs).toEqual([]);
  });

  it("accepts a complete draft and strips unknown keys", () => {
    const parsed = draftSchema.parse({ ...completeDraft(), extra: 1, study: { ...completeDraft().study, surprise: true } });
    expect(parsed).not.toHaveProperty("extra");
    expect(parsed.study).not.toHaveProperty("surprise");
  });

  it("enforces formats only once something is typed", () => {
    expect(issueMessages({ study: { doi: "" } })).toEqual([]);
    expect(issueMessages({ study: { doi: "10.12" } })).toEqual(["study.doi:invalid_doi"]);
    expect(issueMessages({ study: { doi: "10.1234/mdrepo.abc" } })).toEqual([]);
    expect(issueMessages({ study: { embargo: { until: "2027-02-30" } } })).toEqual(["study.embargo.until:invalid_date"]);
    expect(issueMessages({ study: { authors: [{ orcid: "0000-0002-1825-0098" }] } })).toEqual(["study.authors.0.orcid:invalid_orcid"]);
    expect(issueMessages({ study: { authors: [{ orcid: "0000-0002-1825-0097", rorId: "https://ror.org/02j46qs45" }] } })).toEqual([]);
    expect(issueMessages({ study: { authors: [{ rorId: "nope" }] } })).toEqual(["study.authors.0.rorId:invalid_ror"]);
  });

  it("rejects wrong types, non-positive numbers and out-of-range angles", () => {
    expect(issueMessages({ study: { access: "closed" } })).toHaveLength(1);
    expect(issueMessages({ system: { systemSize: 1.5 } })).toEqual(["system.systemSize:not_integer"]);
    expect(issueMessages({ system: { box: { a: 0 } } })).toEqual(["system.box.a:not_positive"]);
    expect(issueMessages({ system: { box: { alpha: 180 } } })).toEqual(["system.box.alpha:angle_range"]);
    expect(issueMessages({ runs: [{ id: "bad id!" }] })).toEqual(["runs.0.id:invalid_id"]);
  });

  it("validates ORCID checksums and ISO dates", () => {
    expect(isValidOrcid("0000-0002-1825-0097")).toBe(true);
    expect(isValidOrcid("0000-0001-5109-3701")).toBe(false);
    expect(isValidOrcid("0000-0002-9079-593X")).toBe(true);
    expect(isValidIsoDate("2026-02-28")).toBe(true);
    expect(isValidIsoDate("2026-13-01")).toBe(false);
  });
});

describe("sanitizeDraft", () => {
  it("drops only the invalid leaves and keeps the rest", () => {
    const result = sanitizeDraft({
      study: { title: "Kept", doi: "not a doi", authors: [{ givenName: "A", orcid: "bad" }], access: "closed" },
      system: { systemSize: -3, forceField: "CHARMM36m" },
      runs: [{ id: "run-1", name: "Keep me", length: 0 }],
    });
    expect(result.study.title).toBe("Kept");
    expect(result.study.doi).toBeUndefined();
    expect(result.study.access).toBeUndefined();
    expect(result.study.authors).toEqual([{ kind: "person", givenName: "A", affiliations: [] }]);
    expect(result.system.forceField).toBe("CHARMM36m");
    expect(result.system.systemSize).toBeUndefined();
    expect(result.runs).toEqual([{ id: "run-1", name: "Keep me", fileKeys: [] }]);
  });

  it("removes a run whose identity is unusable and survives garbage input", () => {
    expect(sanitizeDraft({ runs: [{ name: "no id" }, { id: "ok" }] }).runs.map((run) => run.id)).toEqual(["ok"]);
    expect(sanitizeDraft("garbage")).toEqual(emptyDraft());
    expect(sanitizeDraft(null)).toEqual(emptyDraft());
    expect(sanitizeDraft({ study: 5, runs: "x" })).toEqual(emptyDraft());
  });
});
