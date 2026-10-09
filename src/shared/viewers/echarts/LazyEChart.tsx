"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/shared/ui";
import type { EChartProps } from "./EChart";

// echarts is large and needs a canvas, so it never renders on the server and ships as its own chunk.
const DynamicEChart = dynamic(() => import("./EChart").then((module) => module.EChart), {
  ssr: false,
  loading: () => <Skeleton role="status" aria-label="Loading chart" className="h-full w-full rounded-lg" />,
});

// The fixed-height wrapper reserves the space while the chunk loads, so the page does not shift.
function LazyEChart(props: EChartProps) {
  return (
    <div style={{ height: props.height }} className={props.className}>
      <DynamicEChart {...props} className={undefined} />
    </div>
  );
}

export { LazyEChart };
