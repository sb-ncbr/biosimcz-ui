"use client";

import { useMemo } from "react";
import { LazyEChart } from "../LazyEChart";
import { buildScatterOption } from "../options/scatter";
import type { ScatterChartProps } from "../types";

function ScatterChart({ height, ariaLabel, ref, x, y, color, xAxis, yAxis, colorAxis }: ScatterChartProps) {
  const option = useMemo(() => buildScatterOption({ x, y, color, xAxis, yAxis, colorAxis }), [x, y, color, xAxis, yAxis, colorAxis]);
  return <LazyEChart option={option} height={height} ariaLabel={ariaLabel} ref={ref} />;
}

export { ScatterChart };
