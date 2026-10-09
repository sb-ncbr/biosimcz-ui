import { minMax } from "../transforms";
import type { OptionInput, ScatterChartProps } from "../types";
import { animationFor, grid, valueAxis, xValueAxis, type Option } from "./common";
import { axisTitle, formatValue, tooltipHtml } from "./tooltip";

function buildScatterOption(input: OptionInput<ScatterChartProps>): Option {
  const { x, y, color, xAxis, yAxis, colorAxis } = input;
  const count = Math.min(x.length, y.length);
  const data: number[][] = new Array<number[]>(count);
  for (let i = 0; i < count; i++) data[i] = color ? [x[i]!, y[i]!, color[i] ?? 0] : [x[i]!, y[i]!];

  const bounds = color ? minMax(color) : null;

  return {
    ...animationFor(count),
    grid: grid({ top: color ? 56 : 16 }),
    tooltip: {
      trigger: "item",
      renderMode: "html",
      formatter: (params: unknown) => {
        const v = (params as { value: number[] }).value;
        const rows = [
          { label: axisTitle(xAxis), value: formatValue(v[0]!) },
          { label: axisTitle(yAxis), value: formatValue(v[1]!) },
          ...(colorAxis && v[2] !== undefined ? [{ label: axisTitle(colorAxis), value: formatValue(v[2]) }] : []),
        ];
        return tooltipHtml(rows);
      },
    },
    toolbox: { show: false },
    visualMap:
      color && bounds
        ? {
            type: "continuous",
            orient: "horizontal",
            left: "center",
            top: 4,
            dimension: 2,
            min: bounds.min,
            max: bounds.max === bounds.min ? bounds.min + 1 : bounds.max,
            calculable: false,
            text: [colorAxis ? axisTitle(colorAxis) : "", ""],
          }
        : undefined,
    xAxis: xValueAxis({ ...xAxis, scale: xAxis.scale ?? true }),
    yAxis: valueAxis({ ...yAxis, scale: yAxis.scale ?? true }),
    series: [{ type: "scatter", data, symbolSize: 5, large: count > 5000, progressive: 8000 }],
  };
}

export { buildScatterOption };
