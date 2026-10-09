import type { DensityData, UnitLabel } from "@/entities/analysis";
import type { LineSeries } from "@/shared/viewers/echarts";
import { toPoints } from "../membraneCommon";

type Metric = "number" | "mass" | "charge" | "electron";
type ValueMode = "dens" | "stdv";

// Units are those the old UI printed; the backend never confirmed them (OQ6), so they carry the unconfirmed marker.
const METRICS: readonly { value: Metric; label: string; unit: UnitLabel }[] = [
  { value: "number", label: "Number density", unit: { text: "#/Å^3", confirmed: false } },
  { value: "mass", label: "Mass density", unit: { text: "amu/Å^3", confirmed: false } },
  { value: "charge", label: "Charge density", unit: { text: "e/Å^3", confirmed: false } },
  { value: "electron", label: "Electron density", unit: { text: "electron/Å^3", confirmed: false } },
];

const VALUE_MODES: readonly { value: ValueMode; label: string }[] = [
  { value: "dens", label: "Density" },
  { value: "stdv", label: "Std dev" },
];

const metricInfo = (metric: Metric) => METRICS.find((m) => m.value === metric)!;

const availableMetrics = (data: DensityData): Metric[] =>
  METRICS.filter((m) => data.comps.some((comp) => comp[m.value])).map((m) => m.value);

const componentName = (name: string, index: number): string => (name.trim() ? name.trim() : `Component ${index + 1}`);

const valuesOf = (comp: DensityData["comps"][number], metric: Metric, mode: ValueMode): readonly number[] | undefined =>
  comp[metric]?.[mode];

const densitySeries = (data: DensityData, metric: Metric, mode: ValueMode): LineSeries[] => {
  const series: LineSeries[] = [];
  data.comps.forEach((comp, index) => {
    const values = valuesOf(comp, metric, mode);
    if (!values || values.length === 0) return;
    series.push({ name: componentName(comp.name, index), data: toPoints(data.z, values) });
  });
  return series;
};

// Signed value with the largest magnitude: a charge profile's dip is a peak too.
const peakOf = (values: readonly number[]): number | null => {
  let best: number | null = null;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    if (best === null || Math.abs(value) > Math.abs(best)) best = value;
  }
  return best;
};

type ComponentRow = { key: string; name: string; selectionSize: string; peak: number | null };

const componentRows = (data: DensityData, metric: Metric, mode: ValueMode): ComponentRow[] =>
  data.comps.map((comp, index) => ({
    key: `${index}-${comp.name}`,
    name: componentName(comp.name, index),
    selectionSize: Array.isArray(comp.selection) && comp.selection.length > 0 ? String(comp.selection.length) : "N/A",
    peak: peakOf(valuesOf(comp, metric, mode) ?? []),
  }));

const densitySummary = (series: readonly LineSeries[], metricLabel: string, samples: number): string =>
  series.length === 0
    ? `No ${metricLabel.toLowerCase()} data for this selection`
    : `${series.length} component${series.length === 1 ? "" : "s"}, ${samples} samples along the membrane normal.`;

export { METRICS, VALUE_MODES, availableMetrics, componentRows, densitySeries, densitySummary, metricInfo, peakOf };
export type { Metric, ValueMode };
