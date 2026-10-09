"use client";

import { useMemo, useRef, useState } from "react";
import type { PocketsData } from "@/entities/analysis";
import { BarChart, ChartFrame, LineChart, seriesToCsv, type ChartHandle } from "@/shared/viewers/echarts";
import type { PanelProps } from "../../model/registry";
import { PanelSelect } from "../PanelSelect";
import { CHART_HEIGHT, effectiveChoice, formatValue, unitFor } from "../structuralCommon";
import { MAX_BAR_POCKETS, pocketsSummary, rankPockets, summarizePockets, volumeSeries } from "./model";

function PocketsPanel({ data, context }: PanelProps<PocketsData>) {
  const lineChart = useRef<ChartHandle>(null);
  const barChart = useRef<ChartHandle>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const pockets = useMemo(() => summarizePockets(data), [data]);
  const ranked = useMemo(() => rankPockets(pockets), [pockets]);
  const selectedId = effectiveChoice(
    chosen,
    pockets.map((p) => p.id),
    null,
  );
  const selected = pockets.find((p) => p.id === selectedId);
  const volumes = data.data[Number(selectedId)]?.volumes;

  const unit = unitFor(context.analysisName, "y");
  const filename = `${context.instanceId}-${context.analysisName}`;
  const frames = volumes?.length ?? 0;
  const lines = useMemo(
    () =>
      selected && volumes
        ? [
            {
              name: selected.name,
              data: volumeSeries(volumes, data.start, data.step),
            },
          ]
        : [],
    [selected, volumes, data.start, data.step],
  );
  const options = useMemo(() => pockets.map((p) => ({ value: p.id, label: p.name })), [pockets]);
  const x = useMemo(() => ({ label: "Frame" }), []);
  const y = useMemo(() => ({ label: "Pocket volume", unit, scale: true }), [unit]);
  const barX = useMemo(() => ({ label: "Average volume", unit }), [unit]);
  const barY = useMemo(() => ({ label: "Pocket" }), []);
  const categories = useMemo(() => ranked.map((p) => p.name), [ranked]);
  const barSeries = useMemo(() => [{ name: "Average volume", data: ranked.map((p) => p.stats!.mean) }], [ranked]);
  const barTooltip = useMemo(
    () => (index: number) => [
      {
        label: "Average volume",
        value: formatValue(ranked[index]?.stats?.mean),
      },
      { label: "Atoms", value: String(ranked[index]?.atoms ?? "-") },
    ],
    [ranked],
  );
  const stats = selected?.stats ?? null;

  if (pockets.length === 0) {
    return <div className="text-text-muted flex items-center justify-center py-12 text-sm">No pocket analysis data available.</div>;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartFrame
        title="Pocket volume over time"
        description="Frame-wise pocket volume (A^3)"
        summary={pocketsSummary(pockets, frames)}
        filename={`${filename}-volume`}
        height={CHART_HEIGHT}
        chart={lineChart}
        csv={() => seriesToCsv(lines, "frame")}
        empty={lines.length === 0 ? { reason: "No pocket time-series data available." } : null}
        actions={pockets.length > 1 ? <PanelSelect label="Pocket" value={selectedId} options={options} onChange={setChosen} /> : undefined}
      >
        <div className="flex flex-col gap-3">
          {stats ? (
            <p className="text-text-muted flex flex-wrap gap-x-6 gap-y-1 text-xs">
              <span>Avg: {formatValue(stats.mean)}</span>
              <span>Min: {formatValue(stats.min)}</span>
              <span>Max: {formatValue(stats.max)}</span>
              {selected ? <span>Atoms: {selected.atoms}</span> : null}
            </p>
          ) : null}
          <LineChart
            ref={lineChart}
            series={lines}
            x={x}
            y={y}
            height={CHART_HEIGHT}
            ariaLabel={`Volume of ${selected?.name ?? "pocket"} over time`}
          />
        </div>
      </ChartFrame>
      <ChartFrame
        title="Average pocket volumes"
        description={`Top ${ranked.length} pockets by average volume`}
        badge={`Total pockets: ${pockets.length}`}
        summary={ranked[0] ? `Largest pocket: ${ranked[0].name}, ${formatValue(ranked[0].stats?.mean)}.` : "No pockets to rank"}
        filename={`${filename}-average`}
        height={CHART_HEIGHT}
        chart={barChart}
        csv={() => ["pocket,average_volume,atoms", ...ranked.map((p) => `${p.name},${p.stats!.mean},${p.atoms}`)].join("\n")}
        empty={ranked.length === 0 ? { reason: "Not enough pocket data for bar chart." } : null}
      >
        <BarChart
          ref={barChart}
          categories={categories}
          series={barSeries}
          horizontal
          x={barX}
          y={barY}
          tooltip={barTooltip}
          height={CHART_HEIGHT}
          ariaLabel="Average volume per pocket, largest first"
        />
        {pockets.length > MAX_BAR_POCKETS ? (
          <p className="text-text-muted mt-2 text-[11px]">Showing top {MAX_BAR_POCKETS} pockets. Filter in 3D to inspect all pockets.</p>
        ) : null}
      </ChartFrame>
    </div>
  );
}

export default PocketsPanel;
