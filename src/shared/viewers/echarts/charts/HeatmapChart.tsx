"use client";

import { useMemo } from "react";
import { LazyEChart } from "../LazyEChart";
import { buildHeatmapOption } from "../options/heatmap";
import type { HeatmapChartProps } from "../types";

function HeatmapChart({ height, ariaLabel, ref, matrix, x, y, value, scale, title, tooltip, xLabels, yLabels }: HeatmapChartProps) {
  const option = useMemo(
    () => buildHeatmapOption({ matrix, x, y, value, scale, title, tooltip, xLabels, yLabels }),
    [matrix, x, y, value, scale, title, tooltip, xLabels, yLabels],
  );
  return <LazyEChart option={option} height={height} ariaLabel={ariaLabel} ref={ref} />;
}

export { HeatmapChart };
