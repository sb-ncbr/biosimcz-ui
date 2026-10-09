"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  BarChart,
  binMatrix,
  ChartFrame,
  HeatmapChart,
  LineChart,
  ScatterChart,
  StatStrip,
  summarize,
  type ChartHandle,
  type LineSeries,
  type StatItem,
  type XY,
} from "@/shared/viewers/echarts";
import { measureChart } from "@/shared/viewers/echarts/probe";

declare global {
  interface Window {
    __chartLab?: { measure: typeof measureChart };
  }
}

// Deterministic pseudo-random so assertions are stable between runs.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const LINE_POINTS = 50_000;
const GRID = 400;
const X_UNIT = { text: "ns", confirmed: true };
const Y_UNIT = { text: "nm", confirmed: true };

function lineSeries(): LineSeries[] {
  const rand = rng(1);
  let v = 0.2;
  const data: XY[] = [];
  for (let i = 0; i < LINE_POINTS; i++) {
    v += (rand() - 0.5) * 0.004;
    data.push([i * 0.02, v + (i % 9000 === 0 ? 0.3 : 0)]);
  }
  return [{ name: "RMSD (50k frames)", data }];
}

function contactMatrix(): number[][] {
  const rand = rng(2);
  return Array.from({ length: GRID }, (_, r) =>
    Array.from({ length: GRID }, (_, c) => Math.max(0, 1 - Math.abs(r - c) / 60) + rand() * 0.15),
  );
}

function categoricalMatrix(): number[][] {
  const rand = rng(3);
  return Array.from({ length: 12 }, () => Array.from({ length: 40 }, () => Math.floor(rand() * 4)));
}

const longLabels = (n: number) => Array.from({ length: n }, (_, i) => `Residue GLY${String(i + 1).padStart(4, "0")} (chain A, loop region)`);

const stats = (values: ArrayLike<number>): StatItem[] => {
  const s = summarize(values);
  if (!s) return [];
  return [
    { label: "Mean", value: s.mean.toFixed(3), unit: "nm" },
    { label: "Std", value: s.std.toFixed(3), unit: "nm" },
    { label: "Min", value: s.min.toFixed(3), unit: "nm" },
    { label: "Max", value: s.max.toFixed(3), unit: "nm" },
  ];
};

function Lab({ id, children }: { id: string; children: ReactNode }) {
  return <div data-chart-lab={id}>{children}</div>;
}

function ChartLab() {
  const lineRef = useRef<ChartHandle>(null);
  const bigRef = useRef<ChartHandle>(null);
  const classRef = useRef<ChartHandle>(null);
  const scatterRef = useRef<ChartHandle>(null);
  const barRef = useRef<ChartHandle>(null);
  const emptyRef = useRef<ChartHandle>(null);

  const series = useMemo(() => lineSeries(), []);
  const big = useMemo(() => binMatrix(contactMatrix(), GRID), []);
  const categorical = useMemo(() => binMatrix(categoricalMatrix(), 100), []);
  const scatter = useMemo(() => {
    const rand = rng(4);
    const x = Array.from({ length: 3000 }, () => rand() * 10);
    const y = x.map((v) => Math.sin(v) + rand() * 0.4);
    return { x, y };
  }, []);
  const lineValues = useMemo(() => series[0]!.data.map((p) => p[1]), [series]);

  useEffect(() => {
    window.__chartLab = { measure: measureChart };
    return () => {
      delete window.__chartLab;
    };
  }, []);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-bold">Chart lab</h1>

      <Lab id="line">
        <ChartFrame title="Long line series" summary="50,000 points decimated with LTTB." filename="line-50k" height={320} chart={lineRef}>
          <div className="flex flex-col gap-3">
            <StatStrip items={stats(lineValues)} label="RMSD statistics" />
            <LineChart
              ref={lineRef}
              series={series}
              x={{ label: "Time", unit: X_UNIT }}
              y={{ label: "RMSD", unit: Y_UNIT }}
              height={320}
              ariaLabel="RMSD over 50,000 frames"
            />
          </div>
        </ChartFrame>
      </Lab>

      <Lab id="heatmap-large">
        <ChartFrame title="Large heatmap" summary="400 x 400 cells, long y labels, title." filename="heatmap-400" height={560} chart={bigRef}>
          <HeatmapChart
            ref={bigRef}
            matrix={big}
            x={{ label: "Residue" }}
            y={{ label: "Residue (long label test)" }}
            value={{ label: "Contact" }}
            scale={{ kind: "continuous" }}
            title="Pairwise contact map, backbone, replica 1"
            yLabels={longLabels(big.rows)}
            height={560}
            ariaLabel="Pairwise contact heatmap, 400 by 400"
          />
        </ChartFrame>
      </Lab>

      <Lab id="heatmap-categorical">
        <ChartFrame title="Categorical heatmap" summary="Four interaction classes." filename="heatmap-classes" height={360} chart={classRef}>
          <HeatmapChart
            ref={classRef}
            matrix={categorical}
            x={{ label: "Frame bin" }}
            y={{ label: "Residue pair" }}
            value={{ label: "Class" }}
            scale={{
              kind: "categorical",
              classes: [
                { value: 0, label: "None" },
                { value: 1, label: "Hydrogen bond" },
                { value: 2, label: "Salt bridge" },
                { value: 3, label: "Hydrophobic" },
              ],
            }}
            title="Interaction classes"
            yLabels={longLabels(categorical.rows)}
            height={360}
            ariaLabel="Interaction class heatmap"
          />
        </ChartFrame>
      </Lab>

      <Lab id="scatter">
        <ChartFrame title="Scatter" summary="3,000 points coloured by x." filename="scatter" height={320} chart={scatterRef}>
          <ScatterChart
            ref={scatterRef}
            x={scatter.x}
            y={scatter.y}
            color={scatter.x}
            xAxis={{ label: "PC1" }}
            yAxis={{ label: "PC2" }}
            colorAxis={{ label: "Time" }}
            height={320}
            ariaLabel="Principal component scatter"
          />
        </ChartFrame>
      </Lab>

      <Lab id="bar">
        <ChartFrame title="Bars" summary="Per-residue fluctuation, ten categories." filename="bars" height={300} chart={barRef}>
          <BarChart
            ref={barRef}
            categories={Array.from({ length: 10 }, (_, i) => `Residue ${i + 1}`)}
            series={[{ name: "RMSF", data: [0.12, 0.2, 0.31, 0.18, 0.44, 0.27, 0.15, 0.22, 0.38, 0.1] }]}
            x={{ label: "Residue" }}
            y={{ label: "RMSF", unit: Y_UNIT }}
            height={300}
            ariaLabel="RMSF per residue"
          />
        </ChartFrame>
      </Lab>

      <Lab id="empty">
        <ChartFrame
          title="Empty chart"
          summary="No data for this analysis."
          filename="empty"
          height={200}
          chart={emptyRef}
          empty={{ reason: "The trajectory has no hydrogen bonds above the cutoff." }}
        >
          {null}
        </ChartFrame>
      </Lab>

      <Lab id="stats">
        <StatStrip
          label="Stat strip"
          items={[
            { label: "Mean", value: "0.214", unit: "nm" },
            { label: "Std", value: "0.031", unit: "nm" },
            { label: "Min", value: "0.150", unit: "nm" },
            { label: "Max", value: "0.402", unit: "nm" },
          ]}
        />
      </Lab>
    </main>
  );
}

export { ChartLab };
