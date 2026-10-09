import type { BinnedMatrix } from "./types";

// Source cells may be booleans (contact maps); Number() turns them into 0/1 so the block mean is a fraction.
type Cell = number | boolean;

const ranges = (n: number, stride: number): [number, number][] => {
  const out: [number, number][] = [];
  for (let s = 0; s < n; s += stride) out.push([s, Math.min(s + stride, n) - 1]);
  return out;
};

// matrix[row][col]; the result is row-major with the same orientation. Empty bins are NaN, never 0.
const binMatrix = (matrix: readonly ArrayLike<Cell>[], target: number): BinnedMatrix => {
  const srcRows = matrix.length;
  const srcCols = srcRows > 0 ? matrix[0]!.length : 0;
  const limit = Math.max(1, Math.floor(target));
  const rowStride = Math.max(1, Math.ceil(srcRows / limit));
  const colStride = Math.max(1, Math.ceil(srcCols / limit));
  const rowRanges = ranges(srcRows, rowStride);
  const colRanges = ranges(srcCols, colStride);
  const rows = rowRanges.length;
  const cols = colRanges.length;
  const values = new Float64Array(rows * cols);

  for (let r = 0; r < rows; r++) {
    const [r0, r1] = rowRanges[r]!;
    for (let c = 0; c < cols; c++) {
      const [c0, c1] = colRanges[c]!;
      let sum = 0;
      let count = 0;
      for (let i = r0; i <= r1; i++) {
        const line = matrix[i]!;
        for (let j = c0; j <= c1 && j < line.length; j++) {
          const v = Number(line[j]);
          if (Number.isNaN(v)) continue;
          sum += v;
          count++;
        }
      }
      values[r * cols + c] = count === 0 ? NaN : sum / count;
    }
  }

  return { rows, cols, values, rowRanges, colRanges, rowStride, colStride };
};

export { binMatrix };
