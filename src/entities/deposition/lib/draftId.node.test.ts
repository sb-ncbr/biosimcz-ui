import { describe, expect, it } from "vitest";
import { draftHref, isDraftId, isRunId, newRunId } from "./draftId";

describe("draft ids", () => {
  it("accepts the ids the client and the mock hand out", () => {
    for (const id of ["draft-figma", "draft-empty", "draft-2-a1b2c3", "abcd1-efgh2", "abcd-1234", "A1"]) expect(isDraftId(id)).toBe(true);
  });

  it("rejects anything that could reach a URL, a redirect or a backend path in a harmful way", () => {
    const bad = ["", "..", ".", "a/b", "a\\b", "a b", "a?x=1", "a#x", "%2e%2e", "-leading", "_leading", "a".repeat(65), "//evil.example", "id\n", "é"];
    for (const id of bad) expect(isDraftId(id), JSON.stringify(id)).toBe(false);
    expect(isDraftId(undefined)).toBe(false);
    expect(isDraftId(42)).toBe(false);
  });

  it("validates run ids and generates valid ones", () => {
    expect(isRunId("run-1")).toBe(true);
    expect(isRunId("a/b")).toBe(false);
    expect(isRunId(newRunId())).toBe(true);
  });

  it("builds encoded wizard hrefs", () => {
    expect(draftHref("draft-1")).toBe("/depositions/draft-1");
    expect(draftHref("draft-1", "study")).toBe("/depositions/draft-1/study");
    expect(draftHref("draft-1", "experiments", "run-2")).toBe("/depositions/draft-1/experiments/run-2");
    expect(draftHref("a/b?c", "review")).toBe("/depositions/a%2Fb%3Fc/review");
  });
});
