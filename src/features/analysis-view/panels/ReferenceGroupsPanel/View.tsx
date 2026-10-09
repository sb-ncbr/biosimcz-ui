"use client";

import { useMemo, useRef, useState } from "react";
import type { ReferenceGroupsData } from "@/entities/analysis";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui";
import { ChartFrame, LineChart, seriesToCsv, type ChartHandle } from "@/shared/viewers/echarts";
import type { PanelProps } from "../../model/registry";
import { CHART_HEIGHT, formatValue } from "../timeSeriesCommon";
import { buildReferenceGroupsModel, readConfig } from "./model";

function ReferenceGroupsPanel({ data, context, config }: PanelProps<ReferenceGroupsData>) {
  const chart = useRef<ChartHandle>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const settings = useMemo(() => readConfig(config), [config]);
  const model = useMemo(
    () => buildReferenceGroupsModel(data, selected, settings, context.analysisName),
    [data, selected, settings, context.analysisName],
  );
  const x = useMemo(() => ({ label: "Frame" }), []);

  if (model.rows.length === 0) {
    return <div className="text-text-muted flex items-center justify-center py-12 text-sm">No groups selected</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <span id="reference-label" className="text-text text-sm font-medium">
            Reference:
          </span>
          <Select value={model.reference ?? undefined} onValueChange={setSelected} disabled={data.references.length === 0}>
            <SelectTrigger aria-labelledby="reference-label" className="min-h-11 w-full sm:w-64">
              <SelectValue placeholder="No references" />
            </SelectTrigger>
            <SelectContent>
              {data.references.map((reference) => (
                <SelectItem key={reference} value={reference}>
                  {reference}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-text-muted flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
          {model.rows.map((row) => (
            <p key={row.group} className="flex items-center gap-3">
              <span className="text-text font-medium">{row.group}</span>
              <span>Avg: {formatValue(row.stats?.mean)}</span>
              <span>Std: {formatValue(row.stats?.std)}</span>
              <span>Min: {formatValue(row.stats?.min)}</span>
              <span>Max: {formatValue(row.stats?.max)}</span>
            </p>
          ))}
        </div>
      </div>
      <ChartFrame
        title={settings.title}
        summary={model.summary}
        filename={`${context.instanceId}-${context.analysisName}-${model.reference ?? "all"}`}
        height={CHART_HEIGHT}
        chart={chart}
        csv={() => seriesToCsv(model.lines, "Frame")}
        empty={model.emptyReason ? { reason: model.emptyReason } : null}
      >
        <div className="flex flex-col gap-4">
          <LineChart
            ref={chart}
            series={model.lines}
            x={x}
            y={model.yAxis}
            legend
            height={CHART_HEIGHT}
            ariaLabel={`${settings.title} line chart`}
          />
        </div>
      </ChartFrame>
    </div>
  );
}

export default ReferenceGroupsPanel;
