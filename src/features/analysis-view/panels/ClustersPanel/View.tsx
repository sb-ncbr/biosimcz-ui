"use client";

import { useMemo, useRef } from "react";
import type { ClustersData } from "@/entities/analysis";
import {
  BarChart,
  ChartFrame,
  HeatmapChart,
  matrixToCsv,
  PanelIntro,
  RankedRow,
  RankedSection,
  rangeLabels,
  StatStrip,
  type ChartHandle,
} from "@/shared/viewers/echarts";
import type { PanelProps } from "../../model/registry";
const CHART_HEIGHT = 420;
import {
  clusterBars,
  clusterTitle,
  clustersSummary,
  rangeText,
  resolvedTransitions,
  topTransitions,
  totalFrames,
  transitionMatrix,
} from "./model";

const HEATMAP_SCALE = { kind: "continuous", min: 0 } as const;

function ClustersPanel({ data, context }: PanelProps<ClustersData>) {
  const barChart = useRef<ChartHandle>(null);
  const heatChart = useRef<ChartHandle>(null);
  const filename = `${context.instanceId}-${context.analysisName}`;
  const bars = useMemo(() => clusterBars(data), [data]);
  const transitions = useMemo(() => resolvedTransitions(data), [data]);
  const matrix = useMemo(() => transitionMatrix(data, transitions), [data, transitions]);
  const top = useMemo(() => topTransitions(transitions), [transitions]);

  const stats = [
    { label: "Clusters", value: String(data.clusters.length) },
    { label: "Total frames", value: String(totalFrames(data)) },
    {
      label: "Cutoff",
      value: Number.isFinite(data.cutoff) ? String(data.cutoff) : "N/A",
    },
    { label: "Version", value: data.version || "N/A" },
  ];
  const mains = useMemo(() => data.clusters.map((c) => c.main), [data]);
  const barX = useMemo(() => ({ label: "Cluster" }), []);
  const barY = useMemo(() => ({ label: "Frames" }), []);
  const heatX = useMemo(() => ({ label: "To cluster" }), []);
  const heatY = useMemo(() => ({ label: "From cluster" }), []);
  const heatValue = useMemo(() => ({ label: "Transitions" }), []);
  const categories = useMemo(() => bars.map((b) => b.label), [bars]);
  const barSeries = useMemo(() => [{ name: "Frames", data: bars.map((b) => b.frames) }], [bars]);
  const barTooltip = useMemo(
    () => (index: number) => [
      { label: "Frames", value: String(bars[index]?.frames ?? "-") },
      {
        label: "Representative frame",
        value: String(bars[index]?.main ?? "-"),
      },
    ],
    [bars],
  );
  const heatTooltip = useMemo(
    () => (cell: { row: number; col: number; value: number }) => [
      { label: "From", value: rangeText(matrix.rowRanges[cell.row], mains) },
      { label: "To", value: rangeText(matrix.colRanges[cell.col], mains) },
      { label: "Count", value: String(cell.value) },
    ],
    [matrix, mains],
  );
  const noClusters = data.clusters.length === 0;
  const heatSummary = top[0]
    ? `${transitions.length} transitions; most frequent ${clusterTitle(top[0].from, mains[top[0].from])} to ${clusterTitle(top[0].to, mains[top[0].to])} (${top[0].count}).`
    : `${transitions.length} transitions`;

  if (noClusters) {
    return <div className="text-text-muted flex items-center justify-center py-12 text-sm">No clustering data available.</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <PanelIntro
        title="Conformational clustering"
        description="Review cluster populations and transition counts derived from the RMSD-based clustering run."
      />
      <StatStrip items={stats} label="Clustering overview" />
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartFrame
          title="Cluster populations"
          description={`Top ${bars.length} clusters ranked by number of frames.`}
          badge={data.clusters.length > bars.length ? `Showing top ${bars.length}` : undefined}
          summary={clustersSummary(data)}
          filename={`${filename}-populations`}
          height={CHART_HEIGHT}
          chart={barChart}
          csv={() => ["cluster,frames,representative_frame", ...bars.map((b) => `${b.label},${b.frames},${b.main}`)].join("\n")}
        >
          <BarChart
            ref={barChart}
            categories={categories}
            series={barSeries}
            x={barX}
            y={barY}
            tooltip={barTooltip}
            height={CHART_HEIGHT}
            ariaLabel="Frames per cluster, largest first"
          />
        </ChartFrame>
        <ChartFrame
          title="Transition counts"
          description="Rows represent origin clusters; columns represent destination clusters."
          badge={`${data.transitions.length} transitions`}
          summary={heatSummary}
          filename={`${filename}-transitions`}
          height={CHART_HEIGHT}
          chart={heatChart}
          csv={() => matrixToCsv(matrix, rangeLabels(matrix.rowRanges, 1, 1, ""), rangeLabels(matrix.colRanges, 1, 1, ""))}
        >
          <HeatmapChart
            ref={heatChart}
            matrix={matrix}
            x={heatX}
            y={heatY}
            value={heatValue}
            scale={HEATMAP_SCALE}
            tooltip={heatTooltip}
            height={CHART_HEIGHT}
            ariaLabel="Transition counts between clusters"
          />
        </ChartFrame>
      </div>
      <RankedSection title="Most frequent transitions" description="Highest-count transitions based on the provided transition table.">
        {top.length === 0 ? (
          <p className="text-text-muted rounded-md border border-dashed px-3 py-4 text-sm">
            No transitions exceed the reporting threshold.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {top.map((t) => (
              <RankedRow
                key={`${t.from}:${t.to}`}
                label={`${clusterTitle(t.from, mains[t.from])} → ${clusterTitle(t.to, mains[t.to])}`}
                value={t.count}
              />
            ))}
          </ol>
        )}
      </RankedSection>
    </div>
  );
}

export default ClustersPanel;
