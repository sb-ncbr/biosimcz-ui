import type { ReactNode } from "react";
import { binMatrix, minMax, rangeLabels } from "@/shared/viewers/echarts/transforms";
import { echartsMock } from "./echartsMock";

type FrameProps = { title: string; description?: string; summary: string; empty?: { reason: string } | null; children: ReactNode };
type Cell = { row: number; col: number; value: number };
type HeatmapProps = {
  matrix: { rows: number; cols: number; values: Float64Array };
  scale: { kind: string; classes?: readonly unknown[] };
  title?: string;
  tooltip?: (cell: Cell) => { label: string; value: string }[];
};

// Extends the shared double with the heatmap and the matrix helpers the matrix panels use.
const matrixChartsMock = {
  ...echartsMock,
  binMatrix,
  minMax,
  rangeLabels,
  matrixToCsv: () => "csv",
  ChartFrame: ({ title, description, summary, empty, children }: FrameProps) => (
    <section aria-label={title}>
      {description ? <p>{description}</p> : null}
      <p data-testid="summary">{summary}</p>
      {empty ? <p role="status">{empty.reason}</p> : children}
    </section>
  ),
  HeatmapChart: ({ matrix, scale, title, tooltip }: HeatmapProps) => (
    <div
      data-testid="heatmap"
      data-rows={matrix.rows}
      data-cols={matrix.cols}
      data-kind={scale.kind}
      data-classes={scale.classes?.length}
      data-title={title}
    >
      {tooltip ? tooltip({ row: 0, col: 0, value: matrix.values[0]! }).map((row) => `${row.label}=${row.value}`).join("|") : null}
    </div>
  ),
};

export { matrixChartsMock };
