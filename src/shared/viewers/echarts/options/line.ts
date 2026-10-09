import { lttb } from "../transforms";
import type { LineChartProps, LineSeries, OptionInput, XY } from "../types";
import { animationFor, grid, valueAxis, xValueAxis, type Option } from "./common";
import { escapeHtml, formatValue } from "./tooltip";

const DEFAULT_SAMPLE_ABOVE = 2000;
// Beyond this the point array itself is too big to hand to echarts, so decimate before setOption.
const PREDECIMATE_ABOVE = 50_000;
const BAND_SUFFIX = "\u0000band";

type LineOptionInput = OptionInput<LineChartProps> & { palette?: readonly string[] };

const decimate = (data: readonly XY[]): readonly XY[] => (data.length > PREDECIMATE_ABOVE ? lttb(data, PREDECIMATE_ABOVE) : data);

// A band is two stacked areas: an invisible base at the lower bound and a translucent layer of the span.
function bandSeries(series: LineSeries, index: number, yAxisIndex: number, color: string | undefined): Option[] {
  const band = series.band!;
  const stack = `${series.name}${BAND_SUFFIX}`;
  const lower = decimate(band.lower);
  const span = decimate(band.upper).map(([x, upper], i): XY => [x, upper - (lower[i]?.[1] ?? 0)]);
  const common = { type: "line", stack, symbol: "none", silent: true, yAxisIndex, name: stack, z: 1 };
  return [
    { ...common, data: lower, lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 } },
    { ...common, data: span, lineStyle: { opacity: 0 }, areaStyle: { opacity: 0.18, color } },
  ];
}

function buildLineOption(input: LineOptionInput): Option {
  const { series, x, y, y2, legend = false, zoom = true, sampleAbove = DEFAULT_SAMPLE_ABOVE, palette } = input;
  let pointCount = 0;

  const main: Option[] = series.map((s) => {
    const data = decimate(s.data);
    pointCount += data.length;
    return {
      type: "line",
      name: s.name,
      data,
      yAxisIndex: s.yAxis ?? 0,
      stack: s.stack,
      showSymbol: false,
      sampling: data.length > sampleAbove ? "lttb" : undefined,
      areaStyle: s.area ? {} : undefined,
      emphasis: { focus: "series" },
    };
  });
  const bands = series.flatMap((s, i) => (s.band ? bandSeries(s, i, s.yAxis ?? 0, palette?.[i % (palette.length || 1)]) : []));
  const hasBand = bands.length > 0;

  const tooltipRows = (params: unknown): string => {
    const list = (Array.isArray(params) ? params : [params]) as { seriesName: string; value: XY; marker: string }[];
    const visible = list.filter((p) => !p.seriesName.endsWith(BAND_SUFFIX));
    if (visible.length === 0) return "";
    const head = `${escapeHtml(x.label)}: ${formatValue(visible[0]!.value[0])}`;
    const rows = visible
      .map((p) => `<div class="flex justify-between gap-4"><span class="text-text-muted">${p.marker}${escapeHtml(p.seriesName)}</span><span class="text-text font-medium">${formatValue(p.value[1])}</span></div>`)
      .join("");
    return `<div class="text-text mb-1 font-semibold">${head}</div>${rows}`;
  };

  return {
    ...animationFor(pointCount),
    grid: grid({ top: legend ? 40 : 16, bottom: zoom ? 64 : 8, ...(y2 ? { right: 8 } : {}) }),
    legend: legend ? { top: 0, data: series.map((s) => s.name) } : undefined,
    tooltip: { trigger: "axis", renderMode: "html", formatter: tooltipRows },
    toolbox: { show: false },
    xAxis: xValueAxis(x),
    yAxis: y2 ? [valueAxis(y), valueAxis(y2, "right")] : [valueAxis(y)],
    dataZoom: zoom ? [{ type: "inside", xAxisIndex: 0, filterMode: "none" }, { type: "slider", xAxisIndex: 0, filterMode: "none", height: 20, bottom: 8 }] : undefined,
    series: hasBand ? [...main, ...bands] : main,
  };
}

export { BAND_SUFFIX, buildLineOption };
