import { describe, expect, it } from "vitest";
import { formatBytes, formatProgress } from "./format";
import { fileKeyProblem, isValidDraftId } from "./keys";
import { rejectionFor } from "./validate";

describe("fileKeyProblem", () => {
  it.each(["topol.top", "my file #1.top", "100%.gro", "Struktura-bílkoviny.pdb", "a?b.top".replace("?", "_")])("accepts %s", (key) => {
    expect(fileKeyProblem(key)).toBeNull();
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["../etc/passwd", "forbidden_chars"],
    ["dir/file.top", "forbidden_chars"],
    ["dir\\file.top", "forbidden_chars"],
    ["a\u0000b.top", "forbidden_chars"],
    ["a\nb.top", "forbidden_chars"],
    ["what?.top", "forbidden_chars"],
    ["..top", "dot_segment"],
    [".hidden.top", "dot_segment"],
    ["a..b.top", "dot_segment"],
    ["trailing.top ", "dot_segment"],
    ["malware.exe", "extension"],
    ["noext", "extension"],
    [`${"a".repeat(300)}.top`, "too_long"],
  ])("rejects %j", (key, problem) => {
    expect(fileKeyProblem(key)).toBe(problem);
  });

  it("checks the extension case-insensitively against the given list", () => {
    expect(fileKeyProblem("CONF.GRO", [".gro"])).toBeNull();
    expect(fileKeyProblem("run.mdp", [".gro"])).toBe("extension");
  });
});

describe("isValidDraftId", () => {
  it("accepts ids and rejects anything that could change the upstream path", () => {
    expect(isValidDraftId("draft-2-abc123")).toBe(true);
    expect(isValidDraftId("abcde-12345")).toBe(true);
    for (const bad of ["", "..", "a/b", "a b", "a?x=1", "a#b", "a%2Fb", "x".repeat(65)]) expect(isValidDraftId(bad)).toBe(false);
  });
});

describe("rejectionFor", () => {
  it("returns the client-side rejection reasons", () => {
    const accept = [".top", ".gro"];
    expect(rejectionFor({ name: "a.top", size: 10 }, accept, 100)).toBeUndefined();
    expect(rejectionFor({ name: "a.top", size: 101 }, accept, 100)).toBe("too_large");
    expect(rejectionFor({ name: "a.exe", size: 1 }, accept, 100)).toBe("type");
    expect(rejectionFor({ name: "a/b.top", size: 1 }, accept, 100)).toBe("invalid_name");
  });
});

describe("format", () => {
  it("formats sizes and progress with a shared unit", () => {
    expect(formatBytes(1_258_291)).toBe("1.2 MB");
    expect(formatBytes(52_428_800)).toBe("50 MB");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatProgress(3_250_586, 5_033_165)).toBe("3.1 of 4.8 MB");
  });
});
