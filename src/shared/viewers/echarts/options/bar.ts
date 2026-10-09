import type { BarChartProps, OptionInput } from "../types";
import { grid, valueAxis, xValueAxis, type Option } from "./common";
import { axisTitle, escapeHtml, formatValue, tooltipHtml } from "./tooltip";

function buildBarOption(input: OptionInput<BarChartProps>): Option {
  const { categories, series, horizontal = false, x, y, tooltip } = input;
  const valueAxisSpec = horizontal ? x : y;
  const categorySpec = horizontal ? y : x;

  const category: Option = {
    type: "category",
    data: [...categories],
    name: axisTitle(categorySpec),
    nameLocation: "middle",
    nameGap: horizontal ? 56 : 32,
    nameRotate: horizontal ? 90 : 0,
    // Horizontal bars list the first category at the top, the way a ranked list reads.
    inverse: horizontal,
    axisLabel: { hideOverlap: true },
  };
  const value: Option = horizontal ? xValueAxis(valueAxisSpec) : valueAxis(valueAxisSpec);

  return {
    animation: true,
    grid: grid({ top: series.length > 1 ? 40 : 16 }),
    legend: series.length > 1 ? { top: 0, data: series.map((s) => s.name) } : undefined,
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      renderMode: "html",
      formatter: (params: unknown) => {
        const list = (Array.isArray(params) ? params : [params]) as { dataIndex: number; name: string; seriesName: string; value: number }[];
        const first = list[0];
        if (!first) return "";
        const rows = tooltip
          ? tooltip(first.dataIndex)
          : list.map((p) => ({ label: p.seriesName, value: formatValue(p.value) }));
        return tooltipHtml(rows, first.name) || escapeHtml(first.name);
      },
    },
    toolbox: { show: false },
    xAxis: horizontal ? value : category,
    yAxis: horizontal ? category : value,
    series: series.map((s) => ({ type: "bar", name: s.name, data: [...s.data], stack: s.stack, emphasis: { focus: "series" } })),
  };
}

export { buildBarOption };
