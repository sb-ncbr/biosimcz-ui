import { baseOf, type DistPerResData } from "@/entities/analysis";
import { binMatrix, rangeLabels, type BinnedMatrix, type Stats, type TooltipRow } from "@/shared/viewers/echarts";
import { binningNote, matrixStats, matrixWidth } from "../matricesCommon";
import type { PanelSelectOption } from "../PanelSelect";
import type { RankedItem } from "../RankedList";
import { formatValue } from "../timeSeriesCommon";

type DistView = "means" | "stdvs";

const DIST_TARGET = 256;
const TOP_PAIRS = 6;

const VIEW_OPTIONS: PanelSelectOption[] = [
  { value: "means", label: "Mean distances" },
  { value: "stdvs", label: "Std. deviation" },
];

const VIEW_TEXT: Record<DistView, { title: string; value: string; list: string; emptyList: string }> = {
  means: { title: "Mean distances", value: "Mean distance", list: "Closest residue pairs", emptyList: "No finite distances" },
  stdvs: { title: "Distance variability", value: "Distance std. deviation", list: "Most variable residue pairs", emptyList: "No finite deviations" },
};

// The -mean and -stdv names open on their own view; the select still reaches the other one.
const defaultView = (analysisName: string): DistView => (baseOf(analysisName) === "dist-perres-stdv" ? "stdvs" : "means");

const effectiveView = (chosen: string | null, analysisName: string): DistView =>
  chosen === "means" || chosen === "stdvs" ? chosen : defaultView(analysisName);

const interactionOptions = (data: DistPerResData): PanelSelectOption[] =>
  data.data.map((entry, index) => ({ value: String(index), label: entry.name }));

type Pair = { row: number; col: number; value: number };

// Keeps only the best `count` cells while scanning, so a large matrix is never sorted whole.
const extremePairs = (matrix: readonly ArrayLike<number>[], count: number, order: "asc" | "desc"): Pair[] => {
  const best: Pair[] = [];
  const better = (a: number, b: number): boolean => (order === "asc" ? a < b : a > b);
  for (let r = 0; r < matrix.length; r++) {
    const line = matrix[r]!;
    for (let c = 0; c < line.length; c++) {
      const value = line[c]!;
      if (!Number.isFinite(value)) continue;
      if (best.length === count && !better(value, best[count - 1]!.value)) continue;
      let at = best.length;
      while (at > 0 && better(value, best[at - 1]!.value)) at--;
      best.splice(at, 0, { row: r, col: c, value });
      if (best.length > count) best.pop();
    }
  }
  return best;
};

type DistPerResModel = {
  options: PanelSelectOption[];
  interactionId: string;
  view: DistView;
  name: string | null;
  matrix: BinnedMatrix | null;
  rawRows: number;
  rawCols: number;
  stats: Stats | null;
  pairs: RankedItem[];
  rowLabels: string[];
  colLabels: string[];
  note: string;
  summary: string;
  emptyReason: string | null;
};

const buildDistPerResModel = (
  data: DistPerResData,
  chosenInteraction: string | null,
  chosenView: string | null,
  analysisName: string,
): DistPerResModel => {
  const options = interactionOptions(data);
  const interactionId = chosenInteraction !== null && data.data[Number(chosenInteraction)] ? chosenInteraction : data.data.length > 0 ? "0" : "";
  const view = effectiveView(chosenView, analysisName);
  const entry = data.data[Number(interactionId)];
  const matrix = entry?.[view] ?? null;
  const text = VIEW_TEXT[view];

  const empty = (reason: string): DistPerResModel => ({
    options,
    interactionId,
    view,
    name: entry?.name ?? null,
    matrix: null,
    rawRows: 0,
    rawCols: 0,
    stats: null,
    pairs: [],
    rowLabels: [],
    colLabels: [],
    note: "",
    summary: reason,
    emptyReason: reason,
  });

  if (!entry) return empty("No distance-per-residue data in this analysis");
  if (!matrix) return empty(`This interaction has no ${text.title.toLowerCase()} matrix. Pick the other view.`);
  const rawRows = matrix.length;
  const rawCols = matrixWidth(matrix);
  if (rawRows === 0 || rawCols === 0) return empty("This matrix has no values");
  const stats = matrixStats(matrix);
  if (!stats) return empty("This matrix has no finite values");

  const binned = binMatrix(matrix, DIST_TARGET);
  // Closest pairs only make sense for distances; for deviations the interesting end is the largest one.
  const pairs = extremePairs(matrix, TOP_PAIRS, view === "means" ? "asc" : "desc").map(
    (pair): RankedItem => ({
      key: `${pair.row}-${pair.col}`,
      label: `Agent 1 residue ${pair.col + 1} - Agent 2 residue ${pair.row + 1}`,
      value: formatValue(pair.value),
    }),
  );
  return {
    options,
    interactionId,
    view,
    name: entry.name,
    matrix: binned,
    rawRows,
    rawCols,
    stats,
    pairs,
    rowLabels: rangeLabels(binned.rowRanges, 1, 1, ""),
    colLabels: rangeLabels(binned.colRanges, 1, 1, ""),
    note: binningNote(binned, rawRows, rawCols),
    summary: `${entry.name}, ${text.title.toLowerCase()}: ${rawRows} x ${rawCols} values, mean ${formatValue(stats.mean)}, min ${formatValue(stats.min)}, max ${formatValue(stats.max)}.`,
    emptyReason: null,
  };
};

const distTooltip =
  (model: DistPerResModel) =>
  ({ row, col, value }: { row: number; col: number; value: number }): TooltipRow[] => [
    { label: "Agent 2 residue", value: model.rowLabels[row] ?? String(row + 1) },
    { label: "Agent 1 residue", value: model.colLabels[col] ?? String(col + 1) },
    { label: VIEW_TEXT[model.view].value, value: formatValue(value) },
  ];

export { VIEW_OPTIONS, VIEW_TEXT, buildDistPerResModel, defaultView, distTooltip, extremePairs };
