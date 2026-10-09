"use client";

import { useMemo } from "react";
import { LazyEChart } from "../LazyEChart";
import { buildBarOption } from "../options/bar";
import type { BarChartProps } from "../types";

function BarChart({ height, ariaLabel, ref, categories, series, horizontal, x, y, tooltip }: BarChartProps) {
  const option = useMemo(() => buildBarOption({ categories, series, horizontal, x, y, tooltip }), [categories, series, horizontal, x, y, tooltip]);
  return <LazyEChart option={option} height={height} ariaLabel={ariaLabel} ref={ref} />;
}

export { BarChart };
