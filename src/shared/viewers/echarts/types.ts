import type { ReactNode, Ref, RefObject } from "react";
import type { ChartHandle } from "./EChart";
import type { BinnedMatrix, Stats, XY } from "./transforms";

// Structural copy of the analysis entity's UnitLabel: shared/ must not import from entities/.
type UnitLabel = { text: string; confirmed: boolean };

type AxisSpec = { label: string; unit?: UnitLabel | null; min?: number; max?: number; scale?: boolean };

// The wrapper escapes text, so callers never pass raw HTML.
type TooltipRow = { label: string; value: string };

type LineSeries = {
  name: string;
  data: readonly XY[];
  band?: { lower: readonly XY[]; upper: readonly XY[] };
  stack?: string;
  area?: boolean;
  yAxis?: 0 | 1;
};

type LineChartProps = {
  series: readonly LineSeries[];
  x: AxisSpec;
  y: AxisSpec;
  y2?: AxisSpec;
  legend?: boolean;
  zoom?: boolean;
  sampleAbove?: number;
  height: number;
  ariaLabel: string;
  ref?: Ref<ChartHandle>;
};

type BarChartProps = {
  categories: readonly string[];
  series: readonly { name: string; data: readonly number[]; stack?: string }[];
  horizontal?: boolean;
  x: AxisSpec;
  y: AxisSpec;
  tooltip?: (index: number) => TooltipRow[];
  height: number;
  ariaLabel: string;
  ref?: Ref<ChartHandle>;
};

type HeatmapScale =
  | { kind: "continuous"; min?: number; max?: number; filter?: boolean }
  | { kind: "categorical"; classes: readonly { value: number; label: string }[] };

type HeatmapChartProps = {
  matrix: BinnedMatrix;
  x: AxisSpec;
  y: AxisSpec;
  value: AxisSpec;
  scale: HeatmapScale;
  title?: string;
  // Category labels per bin; ignored unless the length matches the matrix, so binned maps fall back to index ranges.
  xLabels?: readonly string[];
  yLabels?: readonly string[];
  tooltip?: (cell: { row: number; col: number; value: number }) => TooltipRow[];
  height: number;
  ariaLabel: string;
  ref?: Ref<ChartHandle>;
};

type ScatterChartProps = {
  x: ArrayLike<number>;
  y: ArrayLike<number>;
  color?: ArrayLike<number>;
  xAxis: AxisSpec;
  yAxis: AxisSpec;
  colorAxis?: AxisSpec;
  height: number;
  ariaLabel: string;
  ref?: Ref<ChartHandle>;
};

type ChartFrameProps = {
  title: string;
  description?: string;
  summary: string;
  filename: string;
  height: number;
  chart: RefObject<ChartHandle | null>;
  csv?: () => string;
  empty?: { reason: string } | null;
  // Small outline badge on the right of the header, e.g. the active reference or a count.
  badge?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
};

type StatItem = { label: string; value: string; unit?: string };

// Builders take the chart props minus the wrapper-only fields.
type OptionInput<P> = Omit<P, "ref" | "height" | "ariaLabel">;

export type {
  AxisSpec,
  BarChartProps,
  BinnedMatrix,
  ChartFrameProps,
  ChartHandle,
  HeatmapChartProps,
  HeatmapScale,
  LineChartProps,
  LineSeries,
  OptionInput,
  ScatterChartProps,
  StatItem,
  Stats,
  TooltipRow,
  XY,
};
