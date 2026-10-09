import { describe, expect, it } from "vitest";
import { binMatrix } from "../transforms";
import type { XY } from "../types";
import { buildBarOption } from "./bar";
import { buildHeatmapOption } from "./heatmap";
import { BAND_SUFFIX, buildLineOption } from "./line";
import { buildScatterOption } from "./scatter";
import { escapeHtml, tooltipHtml } from "./tooltip";

type Opt = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- option trees are asserted structurally

const points = (n: number): XY[] => Array.from({ length: n }, (_, i) => [i, Math.sin(i)]);
const axis = { label: "Time", unit: { text: "ns", confirmed: false } };

describe("buildLineOption", () => {
  const base = { x: axis, y: { label: "RMSD" } };

  it("applies containLabel, a hidden toolbox and x zoom by default", () => {
    const o = buildLineOption({ ...base, series: [{ name: "a", data: points(10) }] }) as Opt;
    expect(o.grid.containLabel).toBe(true);
    expect(o.toolbox).toEqual({ show: false });
    expect(o.dataZoom.map((z: Opt) => z.type)).toEqual(["inside", "slider"]);
  });

  it("samples with lttb above the threshold and pre-decimates above 50k points", () => {
    const small = buildLineOption({ ...base, series: [{ name: "a", data: points(1500) }] }) as Opt;
    expect(small.series[0].sampling).toBeUndefined();
    const big = buildLineOption({ ...base, series: [{ name: "a", data: points(2500) }] }) as Opt;
    expect(big.series[0].sampling).toBe("lttb");
    const huge = buildLineOption({ ...base, series: [{ name: "a", data: points(120_000) }] }) as Opt;
    expect(huge.series[0].data).toHaveLength(50_000);
    expect(huge.animation).toBe(false);
  });

  it("turns a band into two stacked transparent areas with the span as second layer", () => {
    const lower = points(4).map(([x]): XY => [x, 1]);
    const upper = points(4).map(([x]): XY => [x, 3]);
    const o = buildLineOption({ ...base, series: [{ name: "a", data: points(4), band: { lower, upper } }], palette: ["red"] }) as Opt;
    expect(o.series).toHaveLength(3);
    expect(o.series[1].name.endsWith(BAND_SUFFIX)).toBe(true);
    expect(o.series[1].stack).toBe(o.series[2].stack);
    expect(o.series[2].data.every((p: XY) => p[1] === 2)).toBe(true);
    expect(o.series[2].areaStyle.color).toBe("red");
    expect(o.legend).toBeUndefined();
  });

  it("adds a second y axis on the right when y2 is set", () => {
    const o = buildLineOption({ ...base, y2: { label: "B" }, series: [{ name: "a", data: points(3) }, { name: "b", data: points(3), yAxis: 1 }] }) as Opt;
    expect(o.yAxis).toHaveLength(2);
    expect(o.yAxis[1].position).toBe("right");
    expect(o.series[1].yAxisIndex).toBe(1);
  });

  it("places the y name in the middle, rotated, with the unit marker", () => {
    const o = buildLineOption({ ...base, y: { label: "RMSD", unit: { text: "nm", confirmed: false } }, series: [] }) as Opt;
    expect(o.yAxis[0]).toMatchObject({ nameLocation: "middle", nameRotate: 90, name: "RMSD (nm?)" });
  });
});

describe("buildBarOption", () => {
  it("swaps axes when horizontal and lists the first category on top", () => {
    const o = buildBarOption({ categories: ["a", "b"], series: [{ name: "s", data: [1, 2] }], horizontal: true, x: { label: "V" }, y: { label: "C" } }) as Opt;
    expect(o.yAxis.type).toBe("category");
    expect(o.yAxis.inverse).toBe(true);
    expect(o.xAxis.type).toBe("value");
    expect(o.grid.containLabel).toBe(true);
  });

  it("keeps category on x when vertical", () => {
    const o = buildBarOption({ categories: ["a"], series: [{ name: "s", data: [1] }], x: { label: "C" }, y: { label: "V" } }) as Opt;
    expect(o.xAxis.type).toBe("category");
    expect(o.yAxis.type).toBe("value");
  });
});

describe("buildHeatmapOption", () => {
  const heat = (rows: number, cols: number, extra: Opt = {}) =>
    buildHeatmapOption({
      matrix: binMatrix(Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => r * 10 + c)), 512),
      x: { label: "X" },
      y: { label: "Y" },
      value: { label: "V" },
      scale: { kind: "continuous" },
      ...extra,
    } as Parameters<typeof buildHeatmapOption>[0]) as Opt;

  it("emits [col,row,value] triples, inverts y and uses containLabel", () => {
    const o = heat(2, 3);
    expect(o.series[0].data).toContainEqual([2, 1, 12]);
    expect(o.yAxis.inverse).toBe(true);
    expect(o.grid.containLabel).toBe(true);
    expect(o.visualMap.min).toBe(0);
    expect(o.visualMap.max).toBe(12);
  });

  it("skips NaN cells", () => {
    const o = buildHeatmapOption({
      matrix: binMatrix([[1, Number.NaN]], 10),
      x: { label: "X" },
      y: { label: "Y" },
      value: { label: "V" },
      scale: { kind: "continuous" },
    }) as Opt;
    expect(o.series[0].data).toEqual([[0, 0, 1]]);
  });

  it("offsets the grid below the title and rotates and thins crowded labels", () => {
    const o = heat(4, 90, { title: "T" });
    expect(o.title.top).toBe(0);
    expect(o.grid.top).toBeGreaterThan(60);
    expect(o.xAxis.axisLabel.rotate).toBe(45);
    expect(o.xAxis.axisLabel.interval).toBeGreaterThan(0);
  });

  it("adds zoom on both axes only for large matrices", () => {
    expect(heat(4, 4).dataZoom).toBeUndefined();
    const o = heat(4, 90);
    expect(o.dataZoom.filter((z: Opt) => z.xAxisIndex === 0)).toHaveLength(2);
    expect(o.dataZoom.filter((z: Opt) => z.yAxisIndex === 0)).toHaveLength(2);
  });

  it("uses a piecewise map for categorical scales", () => {
    const o = heat(2, 2, { scale: { kind: "categorical", classes: [{ value: 0, label: "none" }, { value: 1, label: "hb" }] } });
    expect(o.visualMap.type).toBe("piecewise");
    expect(o.visualMap.pieces).toEqual([{ value: 0, label: "none" }, { value: 1, label: "hb" }]);
  });

  it("handles a constant matrix without a zero-width range", () => {
    const o = buildHeatmapOption({
      matrix: binMatrix([[5, 5]], 10),
      x: { label: "X" },
      y: { label: "Y" },
      value: { label: "V" },
      scale: { kind: "continuous" },
    }) as Opt;
    expect(o.visualMap.max).toBeGreaterThan(o.visualMap.min);
  });
});

describe("buildScatterOption", () => {
  it("adds a colour dimension and visual map only when color is given", () => {
    const plain = buildScatterOption({ x: [1, 2], y: [3, 4], xAxis: { label: "x" }, yAxis: { label: "y" } }) as Opt;
    expect(plain.visualMap).toBeUndefined();
    const colored = buildScatterOption({ x: [1, 2], y: [3, 4], color: [0, 9], xAxis: { label: "x" }, yAxis: { label: "y" } }) as Opt;
    expect(colored.series[0].data[1]).toEqual([2, 4, 9]);
    expect(colored.visualMap).toMatchObject({ min: 0, max: 9 });
  });
});

describe("tooltip helpers", () => {
  it("escapes caller text", () => {
    expect(escapeHtml(`<b>"x"&'</b>`)).toBe("&lt;b&gt;&quot;x&quot;&amp;&#39;&lt;/b&gt;");
    const html = tooltipHtml([{ label: "<i>", value: "1" }], "<h>");
    expect(html).not.toContain("<i>");
    expect(html).not.toContain("<h>");
  });
});
