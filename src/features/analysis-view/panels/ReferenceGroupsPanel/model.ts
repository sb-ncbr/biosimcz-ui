import type { ReferenceGroupsData } from "@/entities/analysis";
import { summarize, type AxisSpec, type LineSeries, type Stats } from "@/shared/viewers/echarts";
import { statsSentence, toPoints, unitFor } from "../timeSeriesCommon";

type ReferenceGroupsConfig = {
  title: string;
  quantity: string;
  // Fixed y range, e.g. TM-score lives in [0, 1].
  yRange: { min: number; max: number } | null;
};

const readConfig = (config: Readonly<Record<string, unknown>> | undefined): ReferenceGroupsConfig => {
  const range = config?.yRange as { min?: unknown; max?: unknown } | undefined;
  return {
    title: typeof config?.title === "string" ? config.title : "Series",
    quantity: typeof config?.quantity === "string" ? config.quantity : "Value",
    yRange: range && typeof range.min === "number" && typeof range.max === "number" ? { min: range.min, max: range.max } : null,
  };
};

// The stored selection is what the user chose; the effective one is derived so a changed payload never leaves a dangling value.
const effectiveReference = (references: readonly string[], selected: string | null): string | null =>
  selected !== null && references.includes(selected) ? selected : (references[0] ?? null);

type GroupRow = { group: string; stats: Stats | null };

type ReferenceGroupsModel = {
  reference: string | null;
  lines: LineSeries[];
  rows: GroupRow[];
  summary: string;
  emptyReason: string | null;
  yAxis: AxisSpec;
};

const buildReferenceGroupsModel = (
  data: ReferenceGroupsData,
  selected: string | null,
  config: ReferenceGroupsConfig,
  analysisName: string,
): ReferenceGroupsModel => {
  const reference = effectiveReference(data.references, selected);
  const entries = data.data.filter((entry) => entry.reference === reference);
  const unit = unitFor(analysisName, "y");
  const rows = entries.map((entry): GroupRow => ({
    group: entry.group,
    stats: summarize(entry.values),
  }));
  const lines = entries.map((entry): LineSeries => ({
    name: entry.group,
    data: toPoints(entry.values, data.start, data.step),
  }));
  const hasPoints = entries.some((entry) => entry.values.length > 0);
  const yAxis: AxisSpec = {
    label: config.quantity,
    unit,
    ...(config.yRange ? { min: config.yRange.min, max: config.yRange.max } : { scale: true }),
  };

  return {
    reference,
    lines,
    rows,
    summary: rows.map((row) => statsSentence(row.group, row.stats, unit)).join("; ") || `${config.title}: no data`,
    emptyReason: hasPoints ? null : "No data for this reference",
    yAxis,
  };
};

export { buildReferenceGroupsModel, effectiveReference, readConfig };
