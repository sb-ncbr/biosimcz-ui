import { ANALYSIS_UNITS, baseOf, isAnalysisBase, type AxisKey, type UnitLabel } from "@/entities/analysis";
import type { StatItem, Stats } from "@/shared/viewers/echarts";

const CHART_HEIGHT = 360;

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

// The selection is derived on every render, so a stale or empty value never needs an effect to repair it.
const effectiveChoice = (chosen: string | null, valid: readonly string[], fallback: string | null): string =>
  chosen !== null && valid.includes(chosen) ? chosen : (fallback !== null && valid.includes(fallback) ? fallback : (valid[0] ?? ""));

export { CHART_HEIGHT, effectiveChoice, formatValue, statItems, unitFor, unitText };
