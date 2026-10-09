type ChartTheme = {
  palette: string[];
  text: string;
  textMuted: string;
  border: string;
  surface: string;
  background: string;
  fontFamily: string;
};

const PALETTE_SIZE = 7;
// Canvas cannot resolve CSS keywords like currentColor, so a missing token falls back to a named colour.
const FALLBACK = "gray";

function readChartTheme(root: HTMLElement = document.documentElement): ChartTheme {
  const style = getComputedStyle(root);
  const token = (name: string) => style.getPropertyValue(name).trim() || FALLBACK;
  return {
    palette: Array.from({ length: PALETTE_SIZE }, (_, index) => token(`--chart-${index + 1}`)),
    text: token("--text"),
    textMuted: token("--text-muted"),
    border: token("--border"),
    surface: token("--surface"),
    background: token("--background"),
    fontFamily: style.getPropertyValue("--font-sans").trim() || "sans-serif",
  };
}

// Shape follows echarts registerTheme; axes and tooltip are styled here so option builders stay colour-free.
function buildEChartsTheme(theme: ChartTheme) {
  const axis = {
    axisLine: { lineStyle: { color: theme.border } },
    axisTick: { lineStyle: { color: theme.border } },
    axisLabel: { color: theme.textMuted },
    nameTextStyle: { color: theme.textMuted },
    splitLine: { lineStyle: { color: theme.border, opacity: 0.6 } },
  };
  return {
    color: theme.palette,
    backgroundColor: "transparent",
    textStyle: { color: theme.text, fontFamily: theme.fontFamily, fontSize: 12 },
    title: { textStyle: { color: theme.text }, subtextStyle: { color: theme.textMuted } },
    legend: { textStyle: { color: theme.textMuted }, itemWidth: 14, itemHeight: 10, itemGap: 16 },
    // Old charts used ECharts defaults: 2px lines without symbols and square bars.
    line: { lineStyle: { width: 2 }, symbolSize: 6, smooth: false },
    bar: { itemStyle: { borderRadius: 0 } },
    categoryAxis: axis,
    valueAxis: axis,
    tooltip: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      textStyle: { color: theme.text },
    },
    dataZoom: { textStyle: { color: theme.textMuted }, borderColor: theme.border },
    visualMap: { textStyle: { color: theme.textMuted } },
  };
}

export { buildEChartsTheme, readChartTheme };
export type { ChartTheme };
