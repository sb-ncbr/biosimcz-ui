"use client";

import { useMemo, useRef, useState } from "react";
import type { HbondsData } from "@/entities/analysis";
import { ChartFrame, HeatmapChart, LineChart, matrixToCsv, PanelIntro, seriesToCsv, type ChartHandle } from "@/shared/viewers/echarts";
import type { PanelProps } from "../../model/registry";
import { PanelSelect } from "../PanelSelect";
import { formatValue } from "../timeSeriesCommon";
import { buildHbondsModel, hbondsTooltip } from "./model";

const CHART_HEIGHT = 420;
const HEAT_X = { label: "Time block" };
const HEAT_Y = { label: "Bond" };
const HEAT_VALUE = { label: "Occupancy" };
const HEAT_SCALE = { kind: "continuous", min: 0, max: 1, filter: false } as const;
const LINE_X = { label: "Time block", scale: true };
const LINE_Y = { label: "Active H-bonds", scale: true };

function HbondsPanel({ data, context }: PanelProps<HbondsData>) {
  const lineChart = useRef<ChartHandle>(null);
  const heatChart = useRef<ChartHandle>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const model = useMemo(() => buildHbondsModel(data, chosen), [data, chosen]);
  const tooltip = useMemo(() => hbondsTooltip(model), [model]);
  const lines = useMemo(() => [{ name: "Bonds formed", data: model.line }], [model.line]);
  const filename = `${context.instanceId}-${context.analysisName}-${model.name ?? "hbonds"}`;
  const cells = model.heat ? model.heat.rows * model.heat.cols : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PanelIntro title="Hydrogen bond persistence" description="Tracks per-interaction H-bond counts and occupancy across frames." />
        <PanelSelect label="Interaction" value={model.interactionId} options={model.options} onChange={setChosen} />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section aria-label="Top occupancy bonds" className="border-border flex flex-col gap-3 rounded-lg border p-4">
          <div>
            <p className="text-text-muted text-xs tracking-wide uppercase">Interaction</p>
            <p className="text-text text-sm font-semibold">{model.name ?? "Interaction"}</p>
          </div>
          <div className="text-text-muted flex flex-col gap-1 text-xs">
            <p>Total bonds: {model.bonds}</p>
            <p>Time blocks: {model.blocks}</p>
          </div>
          {model.formed ? (
            <div className="text-text-muted flex flex-col gap-1 text-xs">
              <p>Avg. formed: {formatValue(model.formed.mean, 2)}</p>
              <p>Max formed: {formatValue(model.formed.max, 1)}</p>
            </div>
          ) : null}
          {model.top.length > 0 ? (
            <div>
              <p className="text-text-muted mb-1 text-xs tracking-wide uppercase">Top occupancy bonds</p>
              <ul className="text-text-muted flex flex-col gap-1 text-xs">
                {model.top.map((bond) => (
                  <li key={bond.key}>
                    {bond.label}: <span className="text-text font-medium">{bond.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-text-muted text-xs">No bond occupancy values</p>
          )}
        </section>
        <div className="xl:col-span-2">
          <ChartFrame
            title="Bonds formed per time block"
            description="Sum of the formation fractions of all bonds in each block"
            badge={`Time blocks: ${model.line.length}`}
            summary={model.summary}
            filename={`${filename}-count`}
            height={CHART_HEIGHT}
            chart={lineChart}
            csv={() => seriesToCsv(lines, "time_block")}
            empty={model.lineEmpty ? { reason: model.lineEmpty } : null}
          >
            <LineChart
              ref={lineChart}
              series={lines}
              x={LINE_X}
              y={LINE_Y}
              height={CHART_HEIGHT}
              ariaLabel="Hydrogen bonds formed per time block"
            />
          </ChartFrame>
        </div>
      </div>
      <ChartFrame
        title="Bond occupancy heatmap"
        description="Rows are bonds, columns are time blocks; a cell is the share of frames in which the bond is formed"
        badge={`Cells: ${cells}`}
        summary={model.summary}
        filename={`${filename}-heatmap`}
        height={CHART_HEIGHT}
        chart={heatChart}
        csv={() => (model.heat ? matrixToCsv(model.heat, model.rowLabels, model.colLabels) : "")}
        empty={model.heatEmpty ? { reason: model.heatEmpty } : null}
      >
        {model.heat ? (
          <HeatmapChart
            ref={heatChart}
            matrix={model.heat}
            x={HEAT_X}
            y={HEAT_Y}
            value={HEAT_VALUE}
            scale={HEAT_SCALE}
            title={model.name ?? undefined}
            tooltip={tooltip}
            height={CHART_HEIGHT}
            ariaLabel="Hydrogen bond occupancy per bond and time block"
          />
        ) : null}
      </ChartFrame>
    </div>
  );
}

export default HbondsPanel;
