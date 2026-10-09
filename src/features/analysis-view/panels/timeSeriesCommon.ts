import { ANALYSIS_UNITS, baseOf, isAnalysisBase, type AxisKey, type UnitLabel } from "@/entities/analysis";
import { type StatItem, type Stats, type XY } from "@/shared/viewers/echarts";

const CHART_HEIGHT = 420;

const unitFor = (analysisName: string, axis: AxisKey): UnitLabel | null => {
  const base = baseOf(analysisName);
  return isAnalysisBase(base) ? (ANALYSIS_UNITS[base][axis] ?? null) : null;
};

// Unconfirmed units carry a trailing question mark, as on the chart axes.
const unitText = (unit: UnitLabel | null): string | undefined => (unit ? `${unit.text}${unit.confirmed ? "" : "?"}` : undefined);

const formatValue = (value: number | null | undefined, digits = 3): string =>
  value === null || value === undefined || !Number.isFinite(value) ? "-" : value.toFixed(digits);

const statItems = (stats: Stats | null, unit: UnitLabel | null): StatItem[] => {
  const text = unitText(unit);
  const item = (label: string, value: number | undefined): StatItem => ({
    label,
    value: formatValue(value),
    ...(text ? { unit: text } : {}),
  });
  return [item("Avg", stats?.mean), item("Std", stats?.std), item("Min", stats?.min), item("Max", stats?.max)];
};

const statsSentence = (label: string, stats: Stats | null, unit: UnitLabel | null): string => {
  if (!stats) return `${label}: no finite values`;
  const text = unitText(unit);
  const suffix = text ? ` ${text}` : "";
  return `${label}: mean ${formatValue(stats.mean)}${suffix}, min ${formatValue(stats.min)}, max ${formatValue(stats.max)}`;
};

const toPoints = (values: readonly number[], start: number, step: number): XY[] =>
  values.map((value, index): XY => [start + index * step, value]);

export { CHART_HEIGHT, formatValue, statItems, statsSentence, toPoints, unitFor };
