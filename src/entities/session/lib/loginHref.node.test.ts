import { describe, expect, it } from "vitest";
import { loginHref } from "./loginHref";

describe("loginHref", () => {
  it("encodes a safe next and flags a backend-rejected session", () => {
    expect(loginHref("/depositions?page=2")).toBe("/login?next=%2Fdepositions%3Fpage%3D2");
    expect(loginHref("/depositions", { expired: true })).toBe("/login?next=%2Fdepositions&expired=1");
    expect(loginHref("//evil.example")).toBe("/login?next=%2F");
  });
});
