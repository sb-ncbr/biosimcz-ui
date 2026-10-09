import type { PairwiseData } from "@/entities/analysis";
import { binMatrix, rangeLabels, type BinnedMatrix, type Stats, type TooltipRow } from "@/shared/viewers/echarts";
import { binningNote, matrixStats, matrixWidth } from "../matricesCommon";
import type { PanelSelectOption } from "../PanelSelect";
import { formatValue } from "../timeSeriesCommon";

type PairwiseVariant = "global" | "interface";

const PAIRWISE_TARGET = 512;

const VARIANT_TEXT: Record<PairwiseVariant, { title: string; description?: string }> = {
  global: { title: "Pairwise RMSD" },
  interface: {
    title: "Pairwise deviation heatmap",
    description: "Darker colors indicate higher RMSD between the selected interface frames.",
  },
};

const readVariant = (config: Readonly<Record<string, unknown>> | undefined): PairwiseVariant =>
  config?.variant === "interface" ? "interface" : "global";

type PairwiseModel = {
  options: PanelSelectOption[];
  selectedId: string;
  name: string | null;
  matrix: BinnedMatrix | null;
  rawRows: number;
  rawCols: number;
  stats: Stats | null;
  note: string;
  summary: string;
  emptyReason: string | null;
  rowLabels: string[];
  colLabels: string[];
};

const matrixOptions = (data: PairwiseData): PanelSelectOption[] =>
  data.matrices.map((entry, index) => ({
    value: String(index),
    label: entry.name.trim() || `Interaction ${index + 1}`,
  }));

// Derived on every render: a stale choice never needs an effect to repair it.
const effectiveMatrix = (data: PairwiseData, chosen: string | null): string => {
  if (chosen !== null && data.matrices[Number(chosen)]) return chosen;
  return data.matrices.length > 0 ? "0" : "";
};

const buildPairwiseModel = (data: PairwiseData, chosen: string | null): PairwiseModel => {
  const selectedId = effectiveMatrix(data, chosen);
  const entry = data.matrices[Number(selectedId)];
  const options = matrixOptions(data);
  const empty = (reason: string, name: string | null): PairwiseModel => ({
    options,
    selectedId,
    name,
    matrix: null,
    rawRows: 0,
    rawCols: 0,
    stats: null,
    note: "",
    summary: reason,
    emptyReason: reason,
    rowLabels: [],
    colLabels: [],
  });

  if (!entry) return empty("No pairwise matrix in this analysis", null);
  const rawRows = entry.values.length;
  const rawCols = matrixWidth(entry.values);
  if (rawRows === 0 || rawCols === 0) return empty("This pairwise matrix has no values", entry.name);
  const stats = matrixStats(entry.values);
  if (!stats) return empty("This pairwise matrix has no finite values", entry.name);

  const matrix = binMatrix(entry.values, PAIRWISE_TARGET);
  return {
    options,
    selectedId,
    name: entry.name,
    matrix,
    rawRows,
    rawCols,
    stats,
    note: binningNote(matrix, rawRows, rawCols),
    summary: `${entry.name}: ${rawRows} x ${rawCols} snapshots, mean ${formatValue(stats.mean)}, min ${formatValue(stats.min)}, max ${formatValue(stats.max)}.`,
    emptyReason: null,
    rowLabels: rangeLabels(matrix.rowRanges, data.start, data.step, ""),
    colLabels: rangeLabels(matrix.colRanges, data.start, data.step, ""),
  };
};

// Row = first snapshot, column = second; the same orientation the payload and the chart builder use.
const pairwiseTooltip =
  (model: PairwiseModel) =>
  ({ row, col, value }: { row: number; col: number; value: number }): TooltipRow[] => [
    { label: "Frames (rows)", value: model.rowLabels[row] ?? String(row) },
    { label: "Frames (columns)", value: model.colLabels[col] ?? String(col) },
    { label: "RMSD", value: formatValue(value) },
  ];

export { VARIANT_TEXT, buildPairwiseModel, effectiveMatrix, pairwiseTooltip, readVariant };
