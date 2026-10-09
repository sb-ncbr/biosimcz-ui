"use client";

import { useMemo, useRef, useState } from "react";
import type { InteractionData } from "@/entities/analysis";
import { ChartFrame, HeatmapChart, matrixToCsv, PanelIntro, type ChartHandle } from "@/shared/viewers/echarts";
import type { PanelProps } from "../../model/registry";
import { PanelSelect } from "../PanelSelect";
import { SNAPSHOT_LIMIT, buildInteractionsModel, countText, interactionsTooltip, type Level, type SideInfo } from "./model";

const CHART_HEIGHT = 420;
const VALUE = { label: "Interface class" };
const LEGEND = "Value legend: 0 = none, 1 = agent 2 interface, 2 = agent 1 interface, 3 = both.";

function SideSnapshot({ side, level }: { side: SideInfo; level: Level }) {
  const noun = level === "residue" ? "Residue" : "Atom";
  return (
    <div>
      <p className="text-text mb-1 font-medium">{side.agent}</p>
      <p>
        {side.sample.length > 0 ? side.sample.map((item) => `${noun} ${item}`).join(", ") : "None"}
        {side.hidden > 0 ? ` and ${side.hidden} more (first ${SNAPSHOT_LIMIT} shown)` : ""}
      </p>
    </div>
  );
}

function InteractionsPanel({ data, context }: PanelProps<InteractionData[]>) {
  const chart = useRef<ChartHandle>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const model = useMemo(() => buildInteractionsModel(data, chosen), [data, chosen]);
  const tooltip = useMemo(() => interactionsTooltip(model), [model]);
  const axisItem = model.level === "atom" ? "Atom" : "Residue";
  const x = useMemo(() => ({ label: `${model.sides?.[0].agent ?? "Agent 1"} ${axisItem.toLowerCase()} (position)` }), [model.sides, axisItem]);
  const y = useMemo(() => ({ label: `${model.sides?.[1].agent ?? "Agent 2"} ${axisItem.toLowerCase()} (position)` }), [model.sides, axisItem]);
  const cells = model.matrix ? model.matrix.rows * model.matrix.cols : 0;
  const description = model.categorical ? LEGEND : model.note || undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PanelIntro title="Interaction interfaces" description="Highlights residues participating in each agent interface." />
        <PanelSelect label="Interaction" value={model.selectedId} options={model.options} onChange={setChosen} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section aria-label="Interaction summary" className="border-border flex flex-col gap-2 rounded-lg border p-4">
          <p className="text-text text-sm font-semibold">{model.name ?? "Interaction"}</p>
          {model.sides && model.level ? (
            <>
              <div className="text-text-muted flex flex-col gap-1 text-xs">
                <p>{`Agent 1 (${model.sides[0].agent}): ${countText(model.sides[0].total, model.level)} - Interface ${model.sides[0].interfaceCount}`}</p>
                <p>{`Agent 2 (${model.sides[1].agent}): ${countText(model.sides[1].total, model.level)} - Interface ${model.sides[1].interfaceCount}`}</p>
              </div>
              <div>
                <p className="text-text-muted mb-1 text-xs tracking-wide uppercase">
                  {model.level === "residue" ? "Interface residues snapshot" : "Interface atoms snapshot"}
                </p>
                <div className="text-text-muted grid grid-cols-1 gap-2 text-xs">
                  <SideSnapshot side={model.sides[0]} level={model.level} />
                  <SideSnapshot side={model.sides[1]} level={model.level} />
                </div>
              </div>
            </>
          ) : null}
        </section>
        <div className="lg:col-span-2">
          <ChartFrame
            title="Interface coverage heatmap"
            description={description}
            badge={`Cells: ${cells}`}
            summary={model.summary}
            filename={`${context.instanceId}-${context.analysisName}-${model.name ?? "interaction"}`}
            height={CHART_HEIGHT}
            chart={chart}
            csv={() => (model.matrix ? matrixToCsv(model.matrix, model.rowLabels, model.colLabels) : "")}
            empty={model.emptyReason ? { reason: model.emptyReason } : null}
          >
            {model.matrix ? (
              <HeatmapChart
                ref={chart}
                matrix={model.matrix}
                x={x}
                y={y}
                value={VALUE}
                scale={model.scale}
                title={model.name ?? undefined}
                tooltip={tooltip}
                height={CHART_HEIGHT}
                ariaLabel={`Interface coverage between ${model.sides?.[0].agent ?? "agent 1"} and ${model.sides?.[1].agent ?? "agent 2"}`}
              />
            ) : null}
          </ChartFrame>
        </div>
      </div>
    </div>
  );
}

export default InteractionsPanel;
