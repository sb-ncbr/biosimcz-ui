"use client";

import { useMemo, useRef, useState } from "react";
import type { RmsdPerResidueData } from "@/entities/analysis";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui";
import { ChartFrame, LineChart, seriesToCsv, type ChartHandle } from "@/shared/viewers/echarts";
import type { PanelProps } from "../../model/registry";
import { CHART_HEIGHT, formatValue, unitFor } from "../timeSeriesCommon";
import { buildRmsdPerResidueModel } from "./model";

function RmsdPerResiduePanel({ data, context }: PanelProps<RmsdPerResidueData>) {
  const chart = useRef<ChartHandle>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const model = useMemo(() => buildRmsdPerResidueModel(data, selected, context.analysisName), [data, selected, context.analysisName]);
  const unit = unitFor(context.analysisName, "y");
  const xLabel = data.step === 1 ? "Frame index" : `Frame (step ${data.step})`;
  const x = useMemo(() => ({ label: xLabel }), [xLabel]);
  const y = useMemo(() => ({ label: "RMSD", unit, scale: true }), [unit]);

  if (data.residues.length === 0) {
    return <div className="text-text-muted flex items-center justify-center py-12 text-sm">No RMSD per residue data available.</div>;
  }

  const stats = model.stats;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        {data.residues.length > 1 ? (
          <div className="flex items-center gap-2">
            <span id="residue-label" className="text-text text-sm font-medium">
              Residue:
            </span>
            <Select
              value={model.index === null ? undefined : String(model.index)}
              onValueChange={(value) => setSelected(Number(value))}
              disabled={data.residues.length === 0}
            >
              <SelectTrigger aria-labelledby="residue-label" className="min-h-11 w-full sm:w-64">
                <SelectValue placeholder="No residues" />
              </SelectTrigger>
              <SelectContent>
                {data.residues.map((residue, index) => (
                  // Index keys: residue names may repeat.
                  <SelectItem key={index} value={String(index)}>
                    {residue.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {stats ? (
          <p className="text-text-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="text-text font-medium">{model.name}</span>
            <span>Avg: {formatValue(stats.mean)}</span>
            <span>Std: {formatValue(stats.std)}</span>
            <span>Min: {formatValue(stats.min)}</span>
            <span>Max: {formatValue(stats.max)}</span>
          </p>
        ) : null}
      </div>
      <ChartFrame
        title="RMSD per residue"
        summary={model.summary}
        filename={`${context.instanceId}-${context.analysisName}-${model.name ?? "residue"}`}
        height={CHART_HEIGHT}
        chart={chart}
        csv={() => seriesToCsv(model.lines, xLabel)}
        empty={model.emptyReason ? { reason: model.emptyReason } : null}
      >
        <div className="flex flex-col gap-4">
          <LineChart
            ref={chart}
            series={model.lines}
            x={x}
            y={y}
            legend={false}
            height={CHART_HEIGHT}
            ariaLabel="RMSD per residue line chart"
          />
        </div>
      </ChartFrame>
    </div>
  );
}

export default RmsdPerResiduePanel;
