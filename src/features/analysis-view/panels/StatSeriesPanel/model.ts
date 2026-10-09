import type { StatSeriesData } from "@/entities/analysis";
import { summarize, type LineSeries, type Stats } from "@/shared/viewers/echarts";
import { statsSentence, toPoints, unitFor } from "../timeSeriesCommon";

type StatSeriesConfig = {
  title: string;
  quantity: string;
  xLabel: string;
  // Index axes (fluctuation) ignore start/step: their samples are per atom, not per frame.
  indexAxis: boolean;
  // Display names by payload key; unknown keys fall back to the key.
  seriesNames: Readonly<Record<string, string>>;
};

const DEFAULT_CONFIG: StatSeriesConfig = { title: "Series", quantity: "Value", xLabel: "Frame", indexAxis: false, seriesNames: {} };

const readConfig = (config: Readonly<Record<string, unknown>> | undefined): StatSeriesConfig => {
  const names = config?.seriesNames;
  return {
    title: typeof config?.title === "string" ? config.title : DEFAULT_CONFIG.title,
    quantity: typeof config?.quantity === "string" ? config.quantity : DEFAULT_CONFIG.quantity,
    xLabel: typeof config?.xLabel === "string" ? config.xLabel : DEFAULT_CONFIG.xLabel,
    indexAxis: config?.indexAxis === true,
    seriesNames: typeof names === "object" && names !== null ? (names as Record<string, string>) : DEFAULT_CONFIG.seriesNames,
  };
};

type StatSeriesRow = { key: string; name: string; stats: Stats | null };

type StatSeriesModel = {
  lines: LineSeries[];
  rows: StatSeriesRow[];
  summary: string;
  empty: boolean;
};

const buildStatSeriesModel = (data: StatSeriesData, config: StatSeriesConfig, analysisName: string): StatSeriesModel => {
  const start = config.indexAxis ? 0 : data.start;
  const step = config.indexAxis ? 1 : data.step;
  const unit = unitFor(analysisName, "y");

  const rows = data.series.map((series): StatSeriesRow => {
    const backend = series.stats;
    const complete = [backend.mean, backend.std, backend.min, backend.max].every(Number.isFinite);
    return { key: series.key, name: config.seriesNames[series.key] ?? series.key, stats: complete ? backend : summarize(series.data) };
  });
  const lines = data.series.map((series, index): LineSeries => ({ name: rows[index]!.name, data: toPoints(series.data, start, step) }));
  const empty = data.series.every((series) => series.data.length === 0);
  const summary = rows.map((row) => statsSentence(row.name, row.stats, unit)).join("; ") || `${config.title}: no series`;

  return { lines, rows, summary, empty };
};

export { buildStatSeriesModel, readConfig };
