import { BarChart, HeatmapChart, LineChart, ScatterChart } from "echarts/charts";
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import { getInstanceByDom, init, registerTheme, use as registerEChartsParts } from "echarts/core";
import type { ECharts, EChartsCoreOption, SetOptionOpts } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";

// Explicit registration keeps the bundle to the chart types we use instead of the full echarts build.
registerEChartsParts([
  GridComponent,
  LegendComponent,
  TooltipComponent,
  DataZoomComponent,
  VisualMapComponent,
  TitleComponent,
  ToolboxComponent,
  LineChart,
  BarChart,
  ScatterChart,
  HeatmapChart,
  CanvasRenderer,
]);

export { getInstanceByDom, init, registerTheme };
export type { ECharts, EChartsCoreOption, SetOptionOpts };
