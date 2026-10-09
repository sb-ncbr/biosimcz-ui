"use client";

import { useMemo, useRef, useState } from "react";
import type { EnergiesData } from "@/entities/analysis";
import { ChartFrame, LineChart, PanelIntro, seriesToCsv, StatStrip, type ChartHandle } from "@/shared/viewers/echarts";
import type { PanelProps } from "../../model/registry";
import { formatValue, unitFor } from "../structuralCommon";
import {
  AGENT_LABELS,
  STAGE_LABELS,
  agentOf,
  effectiveSelection,
  energiesSummary,
  energyLines,
  hasLabels,
  interactionOptions,
  topContributors,
  type Chosen,
} from "./model";
import { EnergySelects } from "./ui/EnergySelects";
import { TopContributors } from "./ui/TopContributors";

const CHART_HEIGHT = 420;

// Stacking needs aligned points, so stacked series are never sampled by the chart.
const NO_SAMPLING = Number.MAX_SAFE_INTEGER;

function EnergiesPanel({ data, context }: PanelProps<EnergiesData>) {
  const lineChart = useRef<ChartHandle>(null);
  const stackChart = useRef<ChartHandle>(null);
  const [chosen, setChosen] = useState<Chosen>({ interaction: null, agent: null, stage: null });
  const selection = effectiveSelection(data, chosen);
  const agent = agentOf(data, selection);
  const entry = data.data[Number(selection.interaction)];
  const series = agent?.stages[selection.stage] ?? null;

  // Left to the React Compiler: memoising on the derived agent object trips preserve-manual-memoization.
  const lines = series ? energyLines(series) : null;
  const top = series ? topContributors(agent, series) : [];
  const options = useMemo(() => interactionOptions(data), [data]);
  const unit = unitFor(context.analysisName, "y");
  const filename = `${context.instanceId}-${context.analysisName}`;
  const itemName = hasLabels(agent) ? "Residue" : "Atom";
  const samples = lines?.samples ?? 0;
  const x = useMemo(() => ({ label: `${itemName} index` }), [itemName]);
  const y = useMemo(() => ({ label: "Energy", unit, scale: true }), [unit]);
  const empty = samples === 0 ? { reason: "No energy values for this selection. Pick another interaction, agent or stage." } : null;
  const summary = energiesSummary(entry?.name ?? "No interaction", selection, samples, top[0]);

  const stats = [
    { label: `${itemName}s`, value: String(samples) },
    { label: "Stage", value: STAGE_LABELS[selection.stage] },
    { label: "Agent", value: AGENT_LABELS[selection.agent] },
    { label: "Top |S|", value: top[0] ? formatValue(Math.abs(top[0].value), 2) : "N/A" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PanelIntro title="Interaction energies" description="Inspect per-residue electrostatic and Van der Waals contributions for each interaction agent." />
      <EnergySelects interactions={options} selection={selection} onChange={(patch) => setChosen((c) => ({ ...c, ...patch }))} />
      <StatStrip items={stats} label="Energy overview" />
      <ChartFrame
        title={`${STAGE_LABELS[selection.stage]} energies per ${itemName.toLowerCase()}`}
        description="Three-component line chart for electrostatic, Van der Waals, and their sum."
        badge={`${samples} samples`}
        summary={summary}
        filename={`${filename}-lines`}
        height={CHART_HEIGHT}
        chart={lineChart}
        csv={() => seriesToCsv(lines?.plain ?? [], `${itemName.toLowerCase()}_index`)}
        empty={empty}
      >
        <LineChart
          ref={lineChart}
          series={lines?.plain ?? []}
          x={x}
          y={y}
          legend
          height={CHART_HEIGHT}
          ariaLabel={`${STAGE_LABELS[selection.stage]} energies per ${itemName.toLowerCase()}`}
        />
      </ChartFrame>
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartFrame
          title="Stacked contribution"
          summary={summary}
          filename={`${filename}-stacked`}
          height={CHART_HEIGHT}
          chart={stackChart}
          csv={() => seriesToCsv(lines?.stacked ?? [], `${itemName.toLowerCase()}_index`)}
          empty={empty}
        >
          <LineChart
            ref={stackChart}
            series={lines?.stacked ?? []}
            x={x}
            y={y}
            legend
            sampleAbove={NO_SAMPLING}
            height={CHART_HEIGHT}
            ariaLabel="Stacked electrostatic and Van der Waals energies with their sum"
          />
        </ChartFrame>
        <TopContributors items={top} unit={unit} />
      </div>
    </div>
  );
}

export default EnergiesPanel;
