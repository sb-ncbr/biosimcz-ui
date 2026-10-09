import { describe, expect, it } from "vitest";
import { framesSchema, selectionSchema, trajectoryRequestSchema } from "./trajectory";

describe("framesSchema", () => {
  it.each(["1:1000:10", "1", "5:5", "1:3:1"])("accepts %s", (value) => {
    expect(framesSchema.safeParse(value).success).toBe(true);
  });

  it("rejects 0-based ranges with the 1-based message", () => {
    const result = framesSchema.safeParse("0:3:1");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/numbered from 1/);
  });

  it.each(["10:5", "1:10:0", "a:b", "", "1:2:3:4", "-1:5"])("rejects %s", (value) => {
    expect(framesSchema.safeParse(value).success).toBe(false);
  });

  it("rejects parts beyond the safe integer range", () => {
    expect(framesSchema.safeParse("1:9007199254740993").success).toBe(false);
    expect(framesSchema.safeParse("1:10:99999999999999999999").success).toBe(false);
    expect(framesSchema.safeParse("1:9007199254740991").success).toBe(true);
  });

  it("caps the length at 40 characters", () => {
    expect(framesSchema.safeParse(`${"0".repeat(39)}1`).success).toBe(true);
    expect(framesSchema.safeParse(`${"0".repeat(40)}1`).success).toBe(false);
  });
});

describe("selectionSchema", () => {
  it("accepts printable ASCII", () => {
    expect(selectionSchema.safeParse("protein and name CA").success).toBe(true);
  });

  it.each(["a\nb", "a\u0000b", "a\tb", "café"])("rejects control or non-ASCII characters", (value) => {
    expect(selectionSchema.safeParse(value).success).toBe(false);
  });

  it("rejects over 300 characters", () => {
    expect(selectionSchema.safeParse("a".repeat(301)).success).toBe(false);
    expect(selectionSchema.safeParse("a".repeat(300)).success).toBe(true);
  });
});

describe("trajectoryRequestSchema", () => {
  it("allows both fields to be omitted", () => {
    expect(trajectoryRequestSchema.safeParse({}).success).toBe(true);
  });
});
