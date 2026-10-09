"use client";

import { useMemo, useRef, useState } from "react";
import type { SasaData } from "@/entities/analysis";
import { BarChart, ChartFrame, LineChart, seriesToCsv, summarize, type ChartHandle } from "@/shared/viewers/echarts";
import type { PanelProps } from "../../model/registry";
import { PanelSelect } from "../PanelSelect";
import { effectiveChoice, formatValue, unitFor } from "../structuralCommon";
import { MAX_BAR_RESIDUES, rankResidues, residueLabel, sasaSummary, summarizeResidues, toPoints } from "./model";

const CHART_HEIGHT = 420;

function SasaPanel({ data, context }: PanelProps<SasaData>) {
  const lineChart = useRef<ChartHandle>(null);
  const barChart = useRef<ChartHandle>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const residues = useMemo(() => summarizeResidues(data), [data]);
  const ranked = useMemo(() => rankResidues(residues), [residues]);
  const totalStats = useMemo(() => summarize(data.total), [data.total]);
  const selectedId = effectiveChoice(chosen, residues.map((r) => String(r.index)), null);
  const selected = residues[Number(selectedId)];

  const unit = unitFor(context.analysisName, "y");
  const filename = `${context.instanceId}-${context.analysisName}`;
  const total = useMemo(() => toPoints(data.total, data.step), [data.total, data.step]);
  const overlay = useMemo(() => {
    const values = data.perResidue[Number(selectedId)];
    return values ? toPoints(values, data.step) : null;
  }, [data.perResidue, data.step, selectedId]);
  // The overlay lives on its own axis: one residue is orders of magnitude below the total and would read as flat.
  const lines = useMemo(
    () => [
      { name: "Total SASA", data: total },
      ...(selected && overlay ? [{ name: selected.label, data: overlay, yAxis: 1 as const }] : []),
    ],
    [total, overlay, selected],
  );
  const options = useMemo(() => residues.map((r) => ({ value: String(r.index), label: r.label })), [residues]);
  const x = useMemo(() => ({ label: "Frame", scale: true }), []);
  const y = useMemo(() => ({ label: "Total SASA", unit, scale: true }), [unit]);
  const y2 = useMemo(() => ({ label: "Selected residue", unit, scale: true }), [unit]);
  const barX = useMemo(() => ({ label: "Average SASA", unit }), [unit]);
  const barY = useMemo(() => ({ label: "Residue" }), []);
  const categories = useMemo(() => ranked.map((r) => r.label), [ranked]);
  const barSeries = useMemo(() => [{ name: "Average SASA", data: ranked.map((r) => r.stats!.mean) }], [ranked]);
  const barTooltip = useMemo(
    () => (index: number) => [{ label: "Average SASA", value: formatValue(ranked[index]?.stats?.mean) }],
    [ranked],
  );
  const frames = data.total.length;
  const residueMean = selected?.stats?.mean;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ChartFrame
        title="SASA over time"
        description="Total solvent accessible surface area and optional residue overlay"
        summary={sasaSummary(residues.length, frames, totalStats)}
        filename={`${filename}-time`}
        height={CHART_HEIGHT}
        chart={lineChart}
        csv={() => seriesToCsv(lines, "frame")}
        empty={frames === 0 ? { reason: "No SASA samples in this analysis" } : null}
        actions={<PanelSelect label="Residue" value={selectedId} options={options} onChange={setChosen} />}
      >
        <div className="flex flex-col gap-3">
          <div className="text-text-muted flex flex-wrap gap-x-6 gap-y-1 text-xs">
            {totalStats ? (
              <span>
                Total Avg: {formatValue(totalStats.mean, 2)} (Min: {formatValue(totalStats.min, 2)} / Max: {formatValue(totalStats.max, 2)})
              </span>
            ) : null}
            {selected && residueMean !== undefined ? (
              <span>
                {selected.label} Avg: {formatValue(residueMean, 2)}
              </span>
            ) : null}
          </div>
          <LineChart
            ref={lineChart}
            series={lines}
            x={x}
            y={y}
            y2={y2}
            legend
            height={CHART_HEIGHT}
            ariaLabel={`Total SASA and ${selected?.label ?? residueLabel(0)} over time`}
          />
        </div>
      </ChartFrame>
      <ChartFrame
        title="Residue exposure ranking"
        description={`Average SASA per residue (top ${categories.length})`}
        badge={`Residues analyzed: ${residues.length}`}
        summary={ranked[0] ? `Most exposed: ${ranked[0].label}, ${formatValue(ranked[0].stats?.mean)}.` : "No residues to rank"}
        filename={`${filename}-ranking`}
        height={CHART_HEIGHT}
        chart={barChart}
        csv={() => ["residue,average_sasa", ...ranked.map((r) => `${r.label},${r.stats!.mean}`)].join("\n")}
        empty={ranked.length === 0 ? { reason: "No residue values to rank" } : null}
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
          ariaLabel="Average SASA per residue, largest first"
        />
        {residues.length > MAX_BAR_RESIDUES ? (
          <p className="text-text-muted mt-2 text-[11px]">
            Showing top {MAX_BAR_RESIDUES} residues by exposure. Use the dropdown to inspect others.
          </p>
        ) : null}
      </ChartFrame>
    </div>
  );
}

export default SasaPanel;
