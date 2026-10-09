"use client";

import { useMemo, useRef } from "react";
import type { StatSeriesData } from "@/entities/analysis";
import { ChartFrame, LineChart, seriesToCsv, type ChartHandle } from "@/shared/viewers/echarts";
import type { PanelProps } from "../../model/registry";
import { unitText } from "../structuralCommon";
import { formatValue, unitFor } from "../timeSeriesCommon";
import { buildStatSeriesModel, readConfig } from "./model";

const CHART_HEIGHT = 420;

function StatSeriesPanel({ data, context, config }: PanelProps<StatSeriesData>) {
  const chart = useRef<ChartHandle>(null);
  const settings = useMemo(() => readConfig(config), [config]);
  const model = useMemo(() => buildStatSeriesModel(data, settings, context.analysisName), [data, settings, context.analysisName]);
  const unit = unitFor(context.analysisName, "y");
  const suffix = unitText(unit);
  const x = useMemo(() => ({ label: settings.xLabel }), [settings.xLabel]);
  const y = useMemo(() => ({ label: settings.quantity, unit, scale: true }), [settings.quantity, unit]);
  const withUnit = (value: number | undefined) => `${formatValue(value)}${suffix ? ` ${suffix}` : ""}`;

  return (
    <ChartFrame
      title={settings.title}
      summary={model.summary}
      filename={`${context.instanceId}-${context.analysisName}`}
      height={CHART_HEIGHT}
      chart={chart}
      csv={() => seriesToCsv(model.lines, settings.xLabel)}
      empty={model.empty ? { reason: "No data points in this analysis" } : null}
    >
      <div className="flex flex-col gap-2">
        <div className="text-text-muted flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs">
          {model.rows.map((row) => (
            <div key={row.key} role="group" aria-label={`${row.name} statistics`} className="flex flex-wrap items-center gap-3">
              <span className="text-text/80 font-medium">{row.name}</span>
              <span>Avg: {withUnit(row.stats?.mean)}</span>
              <span>Std: {withUnit(row.stats?.std)}</span>
              <span>Min: {withUnit(row.stats?.min)}</span>
              <span>Max: {withUnit(row.stats?.max)}</span>
            </div>
          ))}
        </div>
        <LineChart
          ref={chart}
          series={model.lines}
          x={x}
          y={y}
          legend={model.lines.length > 1}
          height={CHART_HEIGHT}
          ariaLabel={`${settings.title} line chart`}
        />
      </div>
    </ChartFrame>
  );
}

export default StatSeriesPanel;
