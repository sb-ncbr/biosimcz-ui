import type { ThicknessData } from "@/entities/analysis";
import { summarize, type LineSeries, type Stats } from "@/shared/viewers/echarts";
import { bandOf, toPoints } from "../membraneCommon";

const leafletSeries = (data: ThicknessData): LineSeries[] => {
  const series: LineSeries[] = [];
  const add = (name: string, values: readonly number[] | undefined, std: readonly number[] | undefined) => {
    if (!values || values.length === 0) return;
    const band = bandOf(data.frame, values, std);
    series.push({ name, data: toPoints(data.frame, values), ...(band ? { band } : {}) });
  };
  add("Thickness", data.thickness, data.std_thickness);
  add("Mean positive", data.mean_positive, data.std_positive);
  add("Mean negative", data.mean_negative, data.std_negative);
  return series;
};

const midplaneSeries = (data: ThicknessData): LineSeries[] =>
  data.midplane_z && data.midplane_z.length > 0 ? [{ name: "Midplane Z", data: toPoints(data.frame, data.midplane_z) }] : [];

type ThicknessStats = { thickness: Stats | null; std: Stats | null; stdPositive: Stats | null; stdNegative: Stats | null; gap: number | null };

// The gap is positive minus negative as reported; the sign convention upstream is UNKNOWN, so it is not turned into an absolute value.
const gapMean = (positive: readonly number[] | undefined, negative: readonly number[] | undefined): number | null => {
  if (!positive || !negative) return null;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < Math.min(positive.length, negative.length); i++) {
    const diff = positive[i]! - negative[i]!;
    if (!Number.isFinite(diff)) continue;
    sum += diff;
    count++;
  }
  return count === 0 ? null : sum / count;
};

const thicknessStats = (data: ThicknessData): ThicknessStats => ({
  thickness: summarize(data.thickness),
  std: data.std_thickness ? summarize(data.std_thickness) : null,
  stdPositive: data.std_positive ? summarize(data.std_positive) : null,
  stdNegative: data.std_negative ? summarize(data.std_negative) : null,
  gap: gapMean(data.mean_positive, data.mean_negative),
});

const thicknessSummary = (stats: ThicknessStats, frames: number): string =>
  stats.thickness
    ? `Thickness mean ${stats.thickness.mean.toFixed(2)}, min ${stats.thickness.min.toFixed(2)}, max ${stats.thickness.max.toFixed(2)} over ${frames} frames.`
    : "No finite thickness values";

export { gapMean, leafletSeries, midplaneSeries, thicknessStats, thicknessSummary };
