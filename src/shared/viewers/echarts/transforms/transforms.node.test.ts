import { describe, expect, it } from "vitest";
import { binMatrix, lttb, matrixToCsv, minMax, rangeLabels, seriesToCsv, summarize, type XY } from "./index";

describe("lttb", () => {
  it("keeps first, last and a spike", () => {
    const pts: XY[] = Array.from({ length: 1000 }, (_, i) => [i, i === 503 ? 100 : 0]);
    const out = lttb(pts, 50);
    expect(out).toHaveLength(50);
    expect(out[0]).toEqual(pts[0]);
    expect(out[49]).toEqual(pts[999]);
    expect(out.some(([, y]) => y === 100)).toBe(true);
  });
  it("returns a copy when under threshold", () => {
    const pts: XY[] = [
      [0, 1],
      [1, 2],
    ];
    expect(lttb(pts, 10)).toEqual(pts);
  });
});

describe("minMax and summarize", () => {
  it("handles 300k values without stack overflow", () => {
    const v = new Float64Array(300_000).map((_, i) => i);
    expect(minMax(v)).toEqual({ min: 0, max: 299_999 });
    expect(summarize(v)?.count).toBe(300_000);
  });
  it("ignores non-finite and returns null when empty", () => {
    expect(minMax([NaN, 2, Infinity, -1])).toEqual({ min: -1, max: 2 });
    expect(minMax([NaN])).toBeNull();
    expect(summarize([])).toBeNull();
  });
  it("uses population std", () => {
    expect(summarize([2, 4, 4, 4, 5, 5, 7, 9])).toEqual({ mean: 5, std: 2, min: 2, max: 9, count: 8 });
  });
});

describe("binMatrix", () => {
  it("keeps orientation: rows are matrix rows, cols are matrix columns", () => {
    const m = binMatrix(
      [
        [1, 2, 3],
        [4, 5, 6],
      ],
      512,
    );
    expect([m.rows, m.cols, m.rowStride, m.colStride]).toEqual([2, 3, 1, 1]);
    expect(Array.from(m.values)).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it("block-means, ignores NaN and handles partial bins", () => {
    const m = binMatrix(
      [
        [1, 3, NaN],
        [5, 7, NaN],
        [9, 11, 100],
      ],
      2,
    );
    expect([m.rows, m.cols, m.rowStride, m.colStride]).toEqual([2, 2, 2, 2]);
    expect(m.rowRanges).toEqual([
      [0, 1],
      [2, 2],
    ]);
    expect(m.values[0]).toBe(4);
    expect(m.values[1]).toBeNaN();
    expect(m.values[2]).toBe(10);
    expect(m.values[3]).toBe(100);
  });
  it("empty bin is NaN", () => {
    expect(binMatrix([[NaN, NaN]], 1).values[0]).toBeNaN();
  });
  it("averages booleans into a fraction", () => {
    const m = binMatrix(
      [
        [true, false],
        [true, true],
      ],
      1,
    );
    expect(m.values[0]).toBe(0.75);
  });
});

describe("rangeLabels", () => {
  it("labels single and multi-index ranges", () => {
    expect(
      rangeLabels(
        [
          [0, 0],
          [1, 2],
        ],
        10,
        5,
        "R",
      ),
    ).toEqual(["R10", "R15-20"]);
  });
});

describe("csv", () => {
  it("escapes commas, quotes and newlines", () => {
    const csv = seriesToCsv(
      [
        { name: 'a,"b"', data: [[1, 2]] },
        { name: "c", data: [[2, 3]] },
      ],
      "x\ny",
    );
    expect(csv).toBe('"x\ny","a,""b""",c\n1,2,\n2,,3');
  });
  it("writes empty cells for NaN", () => {
    const m = binMatrix([[1, NaN]], 512);
    expect(matrixToCsv(m, ["r"], ["a", "b"])).toBe(",a,b\nr,1,");
  });
});
