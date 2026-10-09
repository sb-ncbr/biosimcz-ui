import { describe, expect, it } from "vitest";
import { isProtectedPath } from "./protectedPaths";
import { safeNext } from "./safeNext";

describe("safeNext", () => {
  it.each(["/", "/depositions", "/depositions/abc/study?x=1#publishing", "/a%2Fb"])("keeps %s", (path) => {
    expect(safeNext(path)).toBe(path);
  });

  it.each([
    "//evil.example",
    "https://evil.example",
    "http://evil.example/x",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "evil",
    "",
    "/a\nb",
    "/\t/evil.example",
  ])("rejects %j", (path) => {
    expect(safeNext(path)).toBe("/");
  });

  it("handles missing values, arrays and a custom fallback", () => {
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext(null, "/depositions")).toBe("/depositions");
    expect(safeNext(["/ok", "//evil"])).toBe("/ok");
    expect(safeNext("/" + "a".repeat(3000))).toBe("/");
  });
});

describe("isProtectedPath", () => {
  it("protects depositions and community forms only", () => {
    expect(isProtectedPath("/depositions")).toBe(true);
    expect(isProtectedPath("/depositions/x/study")).toBe(true);
    expect(isProtectedPath("/communities/new")).toBe(true);
    expect(isProtectedPath("/communities/abc/edit")).toBe(true);
    expect(isProtectedPath("/communities")).toBe(false);
    expect(isProtectedPath("/communities/abc")).toBe(false);
    expect(isProtectedPath("/depositionsx")).toBe(false);
    expect(isProtectedPath("/login")).toBe(false);
  });
});
