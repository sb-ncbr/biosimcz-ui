import { describe, expect, it } from "vitest";
import { MAX_MATRIX_SIDE, booleanMatrix, nullableNumberArray, numberArray, numberMatrix } from "./primitives";

describe("numberArray", () => {
  it("accepts 2M numbers under 200 ms", () => {
    const values = Array.from({ length: 2_000_000 }, (_, i) => i * 0.5);
    const start = performance.now();
    const result = numberArray.safeParse(values);
    expect(result.success).toBe(true);
    expect(performance.now() - start).toBeLessThan(200);
  });

  it.each([[["1"]], [[1, NaN]], [[Infinity]], [[null]], ["text"], [{}]])("rejects %j", (value) => {
    expect(numberArray.safeParse(value).success).toBe(false);
  });

  it("reports a readable message", () => {
    const result = numberArray.safeParse(["x"]);
    expect(result.success ? "" : result.error.issues[0]!.message).toBe("Expected an array of finite numbers");
  });
});

describe("nullableNumberArray", () => {
  it("allows null but not NaN", () => {
    expect(nullableNumberArray.safeParse([1, null]).success).toBe(true);
    expect(nullableNumberArray.safeParse([NaN]).success).toBe(false);
  });
});

describe("numberMatrix", () => {
  it("requires rectangular rows", () => {
    expect(numberMatrix.safeParse([[1, 2], [3, 4]]).success).toBe(true);
    expect(numberMatrix.safeParse([[1, 2], [3]]).success).toBe(false);
  });

  it("rejects a side above the cap", () => {
    expect(numberMatrix.safeParse([new Array<number>(MAX_MATRIX_SIDE + 1).fill(0)]).success).toBe(false);
    expect(numberMatrix.safeParse(new Array<number[]>(MAX_MATRIX_SIDE + 1).fill([0])).success).toBe(false);
  });
});

describe("booleanMatrix", () => {
  it("accepts booleans and 0/1 and rejects other numbers", () => {
    expect(booleanMatrix.safeParse([[true, 0, 1]]).success).toBe(true);
    expect(booleanMatrix.safeParse([[2]]).success).toBe(false);
  });
});
