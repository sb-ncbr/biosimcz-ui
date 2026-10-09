"use client";

import { useMemo, useRef, useState } from "react";
import type { DistPerResData } from "@/entities/analysis";
import { ChartFrame, HeatmapChart, matrixToCsv, PanelIntro, type ChartHandle } from "@/shared/viewers/echarts";
import type { PanelProps } from "../../model/registry";
import { PanelSelect } from "../PanelSelect";
import { formatValue, unitFor } from "../timeSeriesCommon";
import { VIEW_OPTIONS, VIEW_TEXT, buildDistPerResModel, distTooltip } from "./model";

const CHART_HEIGHT = 420;
const X_AXIS = { label: "Agent 1 residue" };
const Y_AXIS = { label: "Agent 2 residue" };
const SCALE = { kind: "continuous", filter: true } as const;

function DistPerResPanel({ data, context }: PanelProps<DistPerResData>) {
  const chart = useRef<ChartHandle>(null);
  const [interaction, setInteraction] = useState<string | null>(null);
  const [view, setView] = useState<string | null>(null);
  const model = useMemo(
    () => buildDistPerResModel(data, interaction, view, context.analysisName),
    [data, interaction, view, context.analysisName],
  );
  const text = VIEW_TEXT[model.view];
  const tooltip = useMemo(() => distTooltip(model), [model]);
  const unit = unitFor(context.analysisName, "value");
  const value = useMemo(() => ({ label: text.value, unit }), [text.value, unit]);
  const cells = model.matrix ? model.matrix.rows * model.matrix.cols : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PanelIntro title="Residue distance statistics" description="Agent 1 residues on the x-axis, Agent 2 residues on the y-axis." />
        <div className="flex flex-wrap gap-3">
          <PanelSelect label="Interaction" value={model.interactionId} options={model.options} onChange={setInteraction} />
          <PanelSelect label="View" value={model.view} options={VIEW_OPTIONS} onChange={setView} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <section aria-label="Matrix summary" className="border-border flex flex-col gap-3 rounded-lg border p-4">
          <div>
            <p className="text-text-muted text-xs tracking-wide uppercase">Interaction</p>
            <p className="text-text text-sm font-semibold">{model.name ?? "Interaction"}</p>
          </div>
          <div className="text-text-muted flex flex-col gap-1 text-xs">
            <p>Agent 1 residues: {model.rawCols || "-"}</p>
            <p>Agent 2 residues: {model.rawRows || "-"}</p>
          </div>
          {model.stats ? (
            <div className="text-text-muted flex flex-col gap-1 text-xs">
              <p>
                Avg: <span className="text-text font-medium">{formatValue(model.stats.mean)}</span>
              </p>
              <p>
                Min: <span className="text-text font-medium">{formatValue(model.stats.min)}</span>
              </p>
              <p>
                Max: <span className="text-text font-medium">{formatValue(model.stats.max)}</span>
              </p>
            </div>
          ) : null}
          {model.pairs.length > 0 ? (
            <div>
              <h3 className="text-text-muted mb-1 text-xs font-normal tracking-wide uppercase">{text.list}</h3>
              <ul className="text-text-muted flex flex-col gap-1 text-xs">
                {model.pairs.map((pair, index) => (
                  <li key={pair.key}>
                    {`#${index + 1} ${pair.label}: `}
                    <span className="text-text font-medium">{pair.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-text-muted text-xs">{text.emptyList}</p>
          )}
        </section>
        <div className="xl:col-span-3">
          <ChartFrame
            title={text.title}
            description={model.note || undefined}
            badge={`Cells: ${cells}`}
            summary={model.summary}
            filename={`${context.instanceId}-${context.analysisName}-${model.view}-${model.name ?? "matrix"}`}
            height={CHART_HEIGHT}
            chart={chart}
            csv={() => (model.matrix ? matrixToCsv(model.matrix, model.rowLabels, model.colLabels) : "")}
            empty={model.emptyReason ? { reason: model.emptyReason } : null}
          >
            {model.matrix ? (
              <HeatmapChart
                ref={chart}
                matrix={model.matrix}
                x={X_AXIS}
                y={Y_AXIS}
                value={value}
                scale={SCALE}
                title={model.name ?? undefined}
                tooltip={tooltip}
                height={CHART_HEIGHT}
                ariaLabel={`${text.title} heatmap by residue`}
              />
            ) : null}
          </ChartFrame>
        </div>
      </div>
    </div>
  );
}

export default DistPerResPanel;
