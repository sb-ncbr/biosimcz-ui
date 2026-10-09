import { minMax, rangeLabels } from "../transforms";
import type { HeatmapChartProps, OptionInput } from "../types";
import { animationFor, grid, type Option } from "./common";
import { axisTitle, formatValue, tooltipHtml } from "./tooltip";

const LABEL_ROTATE_ABOVE = 30;
const ZOOM_ABOVE = 60;
const PROGRESSIVE = 8000;
const VISUAL_MAP_ROW = 56;

// Cells are always emitted as [col, row, value] from the row-major matrix, so callers never build triples.
function cellsOf(matrix: HeatmapChartProps["matrix"]): [number, number, number][] {
  const cells: [number, number, number][] = [];
  for (let r = 0; r < matrix.rows; r++) {
    for (let c = 0; c < matrix.cols; c++) {
      const value = matrix.values[r * matrix.cols + c]!;
      if (!Number.isNaN(value)) cells.push([c, r, value]);
    }
  }
  return cells;
}

function categoryAxis(labels: string[], axis: HeatmapChartProps["x"], isX: boolean, inverse: boolean): Option {
  const crowded = labels.length > LABEL_ROTATE_ABOVE;
  return {
    type: "category",
    data: labels,
    inverse,
    name: axisTitle(axis),
    nameLocation: "middle",
    nameGap: isX ? (crowded ? 44 : 30) : 52,
    nameRotate: isX ? 0 : 90,
    splitArea: { show: false },
    axisLabel: crowded ? { rotate: isX ? 45 : 0, interval: Math.ceil(labels.length / LABEL_ROTATE_ABOVE) - 1 } : { interval: 0 },
  };
}

function buildHeatmapOption(input: OptionInput<HeatmapChartProps>): Option {
  const { matrix, x, y, value, scale, title, tooltip, xLabels, yLabels } = input;
  const colLabels = xLabels?.length === matrix.cols ? [...xLabels] : rangeLabels(matrix.colRanges, 1, 1, "");
  const rowLabels = yLabels?.length === matrix.rows ? [...yLabels] : rangeLabels(matrix.rowRanges, 1, 1, "");
  const cells = cellsOf(matrix);
  const zoomed = matrix.rows > ZOOM_ABOVE || matrix.cols > ZOOM_ABOVE;

  const bounds = scale.kind === "continuous" ? minMax(matrix.values) : null;
  const min = scale.kind === "continuous" ? (scale.min ?? bounds?.min ?? 0) : 0;
  const max = scale.kind === "continuous" ? (scale.max ?? bounds?.max ?? 1) : 1;

  const visualMap: Option =
    scale.kind === "categorical"
      ? {
          type: "piecewise",
          orient: "horizontal",
          left: "center",
          top: title ? 24 : 4,
          pieces: scale.classes.map((c) => ({ value: c.value, label: c.label })),
          // Compact items so four or five long class names still fit a phone-width canvas.
          itemWidth: 12,
          itemHeight: 12,
          itemGap: 4,
          textStyle: { fontSize: 10 },
          dimension: 2,
        }
      : {
          type: "continuous",
          orient: "horizontal",
          left: "center",
          top: title ? 24 : 4,
          min,
          max: max === min ? min + 1 : max,
          dimension: 2,
          calculable: scale.filter ?? true,
          text: [axisTitle(value), ""],
        };

  const gridTop = (title ? 24 : 4) + VISUAL_MAP_ROW;

  return {
    ...animationFor(cells.length),
    title: title ? { text: title, left: "center", top: 0, textStyle: { fontSize: 14 } } : undefined,
    grid: grid({ top: gridTop, bottom: zoomed ? 64 : 32, ...(zoomed ? { right: 40 } : {}) }),
    tooltip: {
      trigger: "item",
      renderMode: "html",
      formatter: (params: unknown) => {
        const [col, row, cell] = (params as { value: [number, number, number] }).value;
        const rows = tooltip
          ? tooltip({ row, col, value: cell })
          : [
              { label: axisTitle(y), value: rowLabels[row] ?? String(row) },
              { label: axisTitle(x), value: colLabels[col] ?? String(col) },
              { label: axisTitle(value), value: formatValue(cell) },
            ];
        return tooltipHtml(rows);
      },
    },
    toolbox: { show: false },
    visualMap,
    xAxis: categoryAxis(colLabels, x, true, false),
    // Row 0 is drawn at the top, matching how matrices are read.
    yAxis: categoryAxis(rowLabels, y, false, true),
    dataZoom: zoomed
      ? [
          { type: "inside", xAxisIndex: 0, filterMode: "none" },
          { type: "inside", yAxisIndex: 0, filterMode: "none" },
          { type: "slider", xAxisIndex: 0, filterMode: "none", height: 20, bottom: 8, showDetail: false },
          { type: "slider", yAxisIndex: 0, filterMode: "none", width: 20, right: 8, showDetail: false },
        ]
      : undefined,
    series: [{ type: "heatmap", data: cells, progressive: PROGRESSIVE, progressiveThreshold: PROGRESSIVE, emphasis: { itemStyle: { borderWidth: 1 } } }],
  };
}

export { buildHeatmapOption };
