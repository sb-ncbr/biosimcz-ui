import type { AplData } from "@/entities/analysis";
import { minMax, summarize, type LineSeries, type Stats, type XY } from "@/shared/viewers/echarts";
import { bandOf } from "../membraneCommon";

// Both leaflets share one colour range so their cells can be compared by eye.
const sharedRange = (data: AplData): { min: number; max: number } | null => {
  let min = Infinity;
  let max = -Infinity;
  for (const matrix of [data.upper, data.lower]) {
    for (const row of matrix) {
      const range = minMax(row);
      if (!range) continue;
      if (range.min < min) min = range.min;
      if (range.max > max) max = range.max;
    }
  }
  return min > max ? null : { min, max };
};

const gridLabels = (values: readonly number[], length: number, prefix: string): string[] =>
  Array.from({ length }, (_, index) => (values.length === length ? values[index]!.toFixed(1) : `${prefix} ${index + 1}`));

const medianSeries = (data: AplData): LineSeries[] => {
  if (data.median.length < 2) return [];
  const xs = data.median.map((_, index) => index + 1);
  const points = data.median.map((value, index): XY => [xs[index]!, value]);
  const band = bandOf(xs, data.median, data.std);
  return [{ name: "Median", data: points, ...(band ? { band } : {}) }];
};

const aplStats = (data: AplData): { median: Stats | null; std: Stats | null } => ({
  median: summarize(data.median),
  std: summarize(data.std),
});

const gridResolution = (data: AplData): string => {
  const matrix = data.upper[0] ? data.upper : data.lower;
  return matrix[0] ? `${matrix[0].length} × ${matrix.length}` : "? × ?";
};

const aplSummary = (median: Stats | null, frames: number): string =>
  median ? `Median area per lipid ${median.mean.toFixed(2)}${frames > 1 ? ` over ${frames} frames` : ""}.` : "No finite median value";

export { aplStats, aplSummary, gridLabels, gridResolution, medianSeries, sharedRange };
