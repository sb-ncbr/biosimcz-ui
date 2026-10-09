import { describe, expect, it } from "vitest";
import { createTtlCache } from "./ttlCache";

describe("ttlCache", () => {
  it("returns a value until it expires", () => {
    let now = 1_000;
    const cache = createTtlCache<string>(10, () => now);
    cache.set("a", "A", 100);
    expect(cache.get("a")).toBe("A");
    now = 1_099;
    expect(cache.get("a")).toBe("A");
    now = 1_100;
    expect(cache.get("a")).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("evicts the least recently used entry beyond the bound", () => {
    const cache = createTtlCache<number>(2, () => 0);
    cache.set("a", 1, 100);
    cache.set("b", 2, 100);
    expect(cache.get("a")).toBe(1);
    cache.set("c", 3, 100);
    expect(cache.size).toBe(2);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe(1);
    expect(cache.get("c")).toBe(3);
  });

  it("overwrites a key without growing", () => {
    const cache = createTtlCache<number>(2, () => 0);
    cache.set("a", 1, 100);
    cache.set("a", 2, 100);
    expect(cache.size).toBe(1);
    expect(cache.get("a")).toBe(2);
  });
});
