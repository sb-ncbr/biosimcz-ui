import { describe, expect, it } from "vitest";
import { asList, first, oneOf, readFacetValues, toRaw } from "./searchParams";

const limits = { maxValues: 3, maxChars: 5 };

describe("searchParams helpers", () => {
  it("normalises a single value or an array to a list", () => {
    expect(asList(undefined)).toEqual([]);
    expect(asList("a")).toEqual(["a"]);
    expect(asList(["a", "b"])).toEqual(["a", "b"]);
    expect(first(["a", "b"])).toBe("a");
    expect(first(undefined)).toBeUndefined();
  });

  it("picks an allowed value or the fallback", () => {
    expect(oneOf(["x", "y"] as const, "y", "x")).toBe("y");
    expect(oneOf(["x", "y"] as const, "z", "x")).toBe("x");
    expect(oneOf(["x", "y"] as const, undefined, "x")).toBe("x");
  });

  it("trims, drops empty and too long values, dedupes and caps the count", () => {
    expect(readFacetValues([" a ", "", "a", "toolong", "b", "c", "d"], limits)).toEqual(["a", "b", "c"]);
  });

  it("turns URLSearchParams into repeated values and leaves plain objects alone", () => {
    expect(toRaw(new URLSearchParams("k=a&k=b&q=x"))).toEqual({ k: ["a", "b"], q: ["x"] });
    const plain = { k: "a" };
    expect(toRaw(plain)).toBe(plain);
  });
});
