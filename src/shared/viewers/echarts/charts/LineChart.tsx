"use client";

import { useMemo, useSyncExternalStore } from "react";
import { LazyEChart } from "../LazyEChart";
import { buildLineOption } from "../options/line";
import { readChartTheme } from "../theme";
import type { LineChartProps } from "../types";

const subscribe = () => () => {};
const readPalette = () => JSON.stringify(readChartTheme().palette);
const readServer = () => "";

// A band must use its series colour, and the palette is only readable in the browser.
function usePalette(enabled: boolean): readonly string[] | undefined {
  const json = useSyncExternalStore(subscribe, enabled ? readPalette : readServer, readServer);
  return useMemo(() => (json ? (JSON.parse(json) as string[]) : undefined), [json]);
}

function LineChart({ height, ariaLabel, ref, series, x, y, y2, legend, zoom, sampleAbove }: LineChartProps) {
  const palette = usePalette(series.some((s) => s.band));
  const option = useMemo(
    () => buildLineOption({ series, x, y, y2, legend, zoom, sampleAbove, palette }),
    [series, x, y, y2, legend, zoom, sampleAbove, palette],
  );
  return <LazyEChart option={option} height={height} ariaLabel={ariaLabel} ref={ref} />;
}

export { LineChart };
