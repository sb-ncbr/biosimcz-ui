"use client";

import { useMemo, useRef, useState } from "react";
import type { PairwiseData } from "@/entities/analysis";
import { ChartFrame, HeatmapChart, matrixToCsv, PanelIntro, StatStrip, type ChartHandle } from "@/shared/viewers/echarts";
import { Badge } from "@/shared/ui";
import type { PanelProps } from "../../model/registry";
import { MATRIX_HEIGHT } from "../matricesCommon";
import { PanelSelect } from "../PanelSelect";
import { unitFor } from "../timeSeriesCommon";
import { VARIANT_TEXT, buildPairwiseModel, pairwiseTooltip, readVariant } from "./model";

const X_AXIS = { label: "Snapshot index (hover for frames)" };
const Y_AXIS = { label: "Snapshot index" };
const SCALE = { kind: "continuous", filter: true } as const;

const EmptyMessage = ({ children }: { children: string }) => (
  <div className="text-text-muted flex items-center justify-center py-12 text-sm">{children}</div>
);

function PairwisePanel({ data, context, config }: PanelProps<PairwiseData>) {
  const chart = useRef<ChartHandle>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const variant = readVariant(config);
  const text = VARIANT_TEXT[variant];
  const model = useMemo(() => buildPairwiseModel(data, chosen), [data, chosen]);
  const tooltip = useMemo(() => pairwiseTooltip(model), [model]);
  const unit = unitFor(context.analysisName, "value");
  const value = useMemo(() => ({ label: "RMSD", unit }), [unit]);

  const isInterface = variant === "interface";
  const binned = model.matrix !== null && (model.matrix.rowStride > 1 || model.matrix.colStride > 1);
  const strideText = model.matrix ? `${model.matrix.rowStride} × ${model.matrix.colStride}` : "";
  const activeLabel = model.options.find((o) => o.value === model.selectedId)?.label ?? "";
  const select =
    model.options.length > 1 ? (
      <PanelSelect label="Interaction" value={model.selectedId} options={model.options} onChange={setChosen} />
    ) : null;
  const chartTitle = model.name
    ? `${isInterface ? "Interface" : "RMSD pairwise"} · ${model.name}`
    : isInterface
      ? "Interface RMSD"
      : "RMSD pairwise";

  if (isInterface && model.options.length === 0) return <EmptyMessage>No interface RMSD matrices available.</EmptyMessage>;
  if (isInterface && !model.matrix) return <EmptyMessage>Unable to build interface RMSD heatmap for the selected entry.</EmptyMessage>;

  const stats = [
    { label: "Active interface", value: activeLabel },
    {
      label: "Frames captured",
      value: model.rawRows ? String(model.rawRows) : "N/A",
    },
    {
      label: "Frame step",
      value: Number.isFinite(data.step) ? String(data.step) : "N/A",
    },
    {
      label: "Matrix resolution",
      value: model.rawRows && model.rawCols ? `${model.rawRows} × ${model.rawCols}` : "N/A",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {isInterface ? (
        <>
          <PanelIntro
            title="Interface pairwise RMSD"
            description="Compare deviations restricted to interface residues for each interaction. Use the selector to switch between interactions and inspect frame windows with the heatmap."
          />
          <StatStrip items={stats} label="Interface overview" />
        </>
      ) : null}
      <ChartFrame
        title={text.title}
        description={text.description}
        badge={isInterface && model.matrix ? `Raw ${model.rawRows} × ${model.rawCols}` : undefined}
        summary={model.summary}
        filename={`${context.instanceId}-${context.analysisName}-${model.name ?? "matrix"}`}
        height={MATRIX_HEIGHT}
        chart={chart}
        csv={() => (model.matrix ? matrixToCsv(model.matrix, model.rowLabels, model.colLabels) : "")}
        empty={model.emptyReason ? { reason: model.emptyReason } : null}
        actions={
          <>
            {select}
            {isInterface && model.matrix ? (
              binned ? (
                <Badge variant="secondary">{`Stride ${strideText}`}</Badge>
              ) : (
                <Badge variant="outline">Full resolution</Badge>
              )
            ) : null}
          </>
        }
      >
        {model.matrix ? (
          <div className="flex flex-col gap-3">
            {!isInterface && binned ? (
              <p className="text-text-muted text-xs">{`Showing downsampled matrix (stride ${strideText})`}</p>
            ) : null}
            <HeatmapChart
              ref={chart}
              matrix={model.matrix}
              x={X_AXIS}
              y={Y_AXIS}
              value={value}
              scale={SCALE}
              title={chartTitle}
              tooltip={tooltip}
              height={MATRIX_HEIGHT}
              ariaLabel={`${text.title} heatmap, rows and columns are snapshots`}
            />
          </div>
        ) : null}
      </ChartFrame>
    </div>
  );
}

export default PairwisePanel;
