"use client";

import { useMemo, useRef, useState } from "react";
import type { PcaData } from "@/entities/analysis";
import { BarChart, ChartFrame, ScatterChart, type ChartHandle } from "@/shared/viewers/echarts";
import type { PanelProps } from "../../model/registry";
import { PanelSelect } from "../PanelSelect";
import { CHART_HEIGHT, formatValue, unitFor } from "../structuralCommon";
import { axisLabel, buildPcaModel, effectiveComponents, pcaSummary, scatterCsv, scatterInput } from "./model";

function PcaPanel({ data, context }: PanelProps<PcaData>) {
  const screeChart = useRef<ChartHandle>(null);
  const scatterChart = useRef<ChartHandle>(null);
  const [chosen, setChosen] = useState<{ x: string | null; y: string | null }>({
    x: null,
    y: null,
  });
  const model = useMemo(() => buildPcaModel(data), [data]);
  const picked = effectiveComponents(chosen, model.components);
  const points = useMemo(() => scatterInput(data, picked.x, picked.y), [data, picked.x, picked.y]);

  const topShare = model.variance[0];
  const hasScatter = model.components >= 2;
  const unit = unitFor(context.analysisName, "y");
  const filename = `${context.instanceId}-${context.analysisName}`;
  const xLabel = axisLabel(picked.x, model.variance);
  const yLabel = axisLabel(picked.y, model.variance);
  const scatterX = useMemo(() => ({ label: xLabel, unit }), [xLabel, unit]);
  const scatterY = useMemo(() => ({ label: yLabel, unit }), [yLabel, unit]);
  const colorAxis = useMemo(() => ({ label: "Frame index" }), []);
  const screeX = useMemo(() => ({ label: "Component" }), []);
  const screeY = useMemo(() => ({ label: "Eigenvalue", scale: true }), []);
  const categories = useMemo(() => model.eigenvalues.map((_, i) => `PC${i + 1}`), [model.eigenvalues]);
  const screeSeries = useMemo(() => [{ name: "Eigenvalue", data: model.eigenvalues }], [model.eigenvalues]);
  const screeTooltip = useMemo(
    () => (index: number) => [
      { label: "Eigenvalue", value: String(model.eigenvalues[index] ?? "-") },
      {
        label: "Share",
        value: `${((model.variance[index] ?? NaN) * 100).toFixed(1)}%`,
      },
    ],
    [model],
  );

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartFrame
        title="Explained variance"
        description="Scree plot of principal component eigenvalues"
        badge={
          topShare !== undefined && Number.isFinite(topShare)
            ? `Top PC captures ${formatValue(topShare * 100, 1)}% of the variance`
            : undefined
        }
        summary={pcaSummary(model)}
        filename={`${filename}-scree`}
        height={CHART_HEIGHT}
        chart={screeChart}
        csv={() => ["component,eigenvalue", ...model.eigenvalues.map((v, i) => `PC${i + 1},${v}`)].join("\n")}
        empty={model.eigenvalues.length === 0 ? { reason: "No eigenvalues in this analysis" } : null}
      >
        <BarChart
          ref={screeChart}
          categories={categories}
          series={screeSeries}
          x={screeX}
          y={screeY}
          tooltip={screeTooltip}
          height={CHART_HEIGHT}
          ariaLabel="Scree plot of PCA eigenvalues"
        />
      </ChartFrame>
      <ChartFrame
        title="Projection"
        summary={`${points.color.length} frames projected on ${xLabel} and ${yLabel}.`}
        filename={`${filename}-projection`}
        height={CHART_HEIGHT}
        chart={scatterChart}
        csv={() => scatterCsv(points, xLabel, yLabel)}
        empty={
          !hasScatter
            ? {
                reason: "PCA projections need at least two components to show a scatter plot.",
              }
            : points.color.length === 0
              ? { reason: "No projections to plot" }
              : null
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <PanelSelect
              label="X-axis"
              value={String(picked.x)}
              options={model.options}
              onChange={(x) => setChosen((c) => ({ ...c, x }))}
            />
            {hasScatter ? (
              <PanelSelect
                label="Y-axis"
                value={String(picked.y)}
                options={model.options}
                onChange={(y) => setChosen((c) => ({ ...c, y }))}
              />
            ) : null}
          </div>
        }
      >
        <ScatterChart
          ref={scatterChart}
          x={points.x}
          y={points.y}
          color={points.color}
          xAxis={scatterX}
          yAxis={scatterY}
          colorAxis={colorAxis}
          height={CHART_HEIGHT}
          ariaLabel={`PCA projection of ${xLabel} against ${yLabel}`}
        />
      </ChartFrame>
    </div>
  );
}

export default PcaPanel;
