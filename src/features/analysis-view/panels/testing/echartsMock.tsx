import type { ReactNode } from "react";
import { summarize } from "@/shared/viewers/echarts/transforms";

type FrameProps = { title: string; summary: string; empty?: { reason: string } | null; children: ReactNode };

// Test double for the chart facade: renders what panels hand over, as plain DOM.
const echartsMock = {
  summarize,
  seriesToCsv: () => "csv",
  ChartFrame: ({ title, summary, empty, children }: FrameProps) => (
    <section aria-label={title}>
      <p data-testid="summary">{summary}</p>
      {empty ? <p role="status">{empty.reason}</p> : children}
    </section>
  ),
  LineChart: ({ series, y }: { series: readonly { name: string; data: readonly (readonly [number, number])[] }[]; y: { min?: number; max?: number } }) => (
    <div data-testid="line-chart" data-series={series.map((s) => s.name).join("|")} data-first-x={series[0]?.data[0]?.[0]} data-ymin={y.min}>
      {series.length}
    </div>
  ),
  StatStrip: ({ items, label }: { items: readonly { label: string; value: string; unit?: string }[]; label?: string }) => (
    <dl aria-label={label}>
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{`${item.value}${item.unit ? ` ${item.unit}` : ""}`}</dd>
        </div>
      ))}
    </dl>
  ),
};

export { echartsMock };
