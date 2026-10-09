"use client";

import { useEffect, useImperativeHandle, useMemo, useRef, useSyncExternalStore, type Ref } from "react";
import { init, registerTheme, type ECharts, type EChartsCoreOption, type SetOptionOpts } from "./core";
import { buildEChartsTheme, readChartTheme, type ChartTheme } from "./theme";

type ChartHandle = { toPng: () => string | null; resetZoom: () => void };

type EChartProps = {
  option: EChartsCoreOption;
  height: number;
  ariaLabel: string;
  className?: string;
  ref?: Ref<ChartHandle>;
};

const PNG_PIXEL_RATIO = 2;

// Merge (not replace) keeps the zoom when a select changes the data; only series are replaced so removed series disappear.
const UPDATE_FLAGS: SetOptionOpts = { notMerge: false, lazyUpdate: true, replaceMerge: ["series"] };

// Design-system dark mode flips a class or data-theme on <html>; the CSS variables change with it.
function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
  return () => observer.disconnect();
}

const readThemeSnapshot = () => JSON.stringify(readChartTheme());
const readServerSnapshot = () => "";

function EChart({ option, height, ariaLabel, className, ref }: EChartProps) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<ECharts | null>(null);
  const latestOption = useRef(option);
  const themeJson = useSyncExternalStore(subscribeTheme, readThemeSnapshot, readServerSnapshot);
  const theme = useMemo(() => (themeJson ? (JSON.parse(themeJson) as ChartTheme) : null), [themeJson]);

  useImperativeHandle(
    ref,
    () => ({
      toPng: () => chart.current?.getDataURL({ type: "png", pixelRatio: PNG_PIXEL_RATIO, backgroundColor: theme?.background }) ?? null,
      resetZoom: () => chart.current?.dispatchAction({ type: "dataZoom", start: 0, end: 100 }),
    }),
    [theme],
  );

  // Theme is fixed at init time in echarts, so a theme change re-creates the instance.
  useEffect(() => {
    const element = container.current;
    if (!element || !theme) return;
    registerTheme(themeJson, buildEChartsTheme(theme));
    const instance = init(element, themeJson, { renderer: "canvas" });
    instance.setOption(latestOption.current, true);
    chart.current = instance;

    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(element);
    return () => {
      observer.disconnect();
      // zrender keeps painting progressive series after dispose (null layers); an empty repaint invalidates that pending frame.
      instance.clear();
      instance.dispose();
      chart.current = null;
    };
  }, [theme, themeJson]);

  useEffect(() => {
    latestOption.current = option;
    chart.current?.setOption(option, UPDATE_FLAGS);
  }, [option]);

  return <div ref={container} role="img" aria-label={ariaLabel} className={className} style={{ height, width: "100%" }} />;
}

export { EChart };
export type { ChartHandle, EChartProps };
