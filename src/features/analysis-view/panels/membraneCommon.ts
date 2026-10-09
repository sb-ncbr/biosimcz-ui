import { binMatrix, type BinnedMatrix, type LineSeries, type XY } from "@/shared/viewers/echarts";

// Grid maps keep one cell per bin: labels come from the data and would be wrong on binned ranges.
const unbinned = (matrix: readonly (readonly number[])[]): BinnedMatrix => {
  const cols = matrix[0]?.length ?? 0;
  return binMatrix(matrix, Math.max(matrix.length, cols, 1));
};

const toPoints = (xs: ArrayLike<number>, ys: ArrayLike<number>): XY[] => {
  const length = Math.min(xs.length, ys.length);
  const points = new Array<XY>(length);
  for (let i = 0; i < length; i++) points[i] = [xs[i]!, ys[i]!];
  return points;
};

// A band needs a bound per point; a mismatched std array would misalign it, so it is dropped instead of padded.
const bandOf = (xs: ArrayLike<number>, values: ArrayLike<number>, std: ArrayLike<number> | undefined): LineSeries["band"] => {
  if (!std || std.length === 0) return undefined;
  const length = Math.min(xs.length, values.length);
  if (std.length !== length && std.length !== 1) return undefined;
  const lower = new Array<XY>(length);
  const upper = new Array<XY>(length);
  for (let i = 0; i < length; i++) {
    const spread = std[std.length === 1 ? 0 : i]!;
    lower[i] = [xs[i]!, values[i]! - spread];
    upper[i] = [xs[i]!, values[i]! + spread];
  }
  return { lower, upper };
};

export { bandOf, toPoints, unbinned };
