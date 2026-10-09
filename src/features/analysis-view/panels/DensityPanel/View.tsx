"use client";

import { useMemo, useRef, useState } from "react";
import type { DensityData } from "@/entities/analysis";
import { ChartFrame, LineChart, PanelIntro, RankedRow, RankedSection, seriesToCsv, StatStrip, type ChartHandle } from "@/shared/viewers/echarts";
import type { PanelProps } from "../../model/registry";
import { PanelSelect } from "../PanelSelect";
import { effectiveChoice, formatValue, unitFor, unitText } from "../structuralCommon";
import {
  METRICS,
  VALUE_MODES,
  availableMetrics,
  componentRows,
  densitySeries,
  densitySummary,
  metricInfo,
  type Metric,
  type ValueMode,
} from "./model";

const HEIGHT = 420;

function DensityPanel({ data, context }: PanelProps<DensityData>) {
  const chart = useRef<ChartHandle>(null);
  const [chosenMetric, setChosenMetric] = useState<string | null>(null);
  const [chosenMode, setChosenMode] = useState<string | null>(null);
  const present = useMemo(() => availableMetrics(data), [data]);
  const metric = (present.length > 0 ? effectiveChoice(chosenMetric, present, "number") : "number") as Metric;
  const mode = effectiveChoice(chosenMode, VALUE_MODES.map((m) => m.value), "dens") as ValueMode;
  const info = metricInfo(metric);
  const series = useMemo(() => densitySeries(data, metric, mode), [data, metric, mode]);
  const rows = useMemo(() => componentRows(data, metric, mode), [data, metric, mode]);
  const metricOptions = useMemo(() => METRICS.filter((m) => present.includes(m.value)).map((m) => ({ value: m.value, label: m.label })), [present]);
  const xUnit = unitFor(context.analysisName, "x");
  const x = useMemo(() => ({ label: "Z (Angstrom)", unit: xUnit, scale: true }), [xUnit]);
  const y = useMemo(
    () => ({ label: `${info.label}${mode === "stdv" ? " std dev" : ""}`, unit: info.unit, scale: true }),
    [info, mode],
  );
  const unit = unitText(info.unit);
  const modeLabel = VALUE_MODES.find((m) => m.value === mode)!.label;
  const stats = [
    { label: "Samples", value: String(data.z.length) },
    { label: "Components", value: String(data.comps.length) },
    { label: "Metric", value: info.label },
    { label: "Mode", value: modeLabel },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <PanelIntro
          title="Density profiles"
          description="Toggle between number, mass, charge, or electron density to compare leaflet components."
        />
        <div className="flex flex-wrap gap-2">
          <PanelSelect label="Metric" value={metric} options={metricOptions} onChange={setChosenMetric} />
          <PanelSelect label="Value" value={mode} options={VALUE_MODES} onChange={setChosenMode} />
        </div>
      </div>
      <StatStrip items={stats} label="Density profile overview" />
      <ChartFrame
        title="Profile along membrane normal"
        description={`Z-axis samples (${data.z.length}) plotted against ${modeLabel.toLowerCase()}.`}
        badge={unit ? `Units: ${unit}` : undefined}
        summary={densitySummary(series, info.label, data.z.length)}
        filename={`${context.instanceId}-${context.analysisName}`}
        height={HEIGHT}
        chart={chart}
        csv={() => seriesToCsv(series, "z")}
        empty={series.length === 0 ? { reason: "No matching density data available for the selected metric." } : null}
      >
        <LineChart ref={chart} series={series} x={x} y={y} legend height={HEIGHT} ariaLabel={`${info.label} profile per component`} />
      </ChartFrame>
      <RankedSection title="Components overview">
        {rows.length === 0 ? (
          <p className="text-text-muted text-sm">No components in this analysis</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {rows.map((row) => (
              <RankedRow
                key={row.key}
                label={
                  <>
                    <span className="block font-semibold">{row.name}</span>
                    <span className="text-text-muted block text-xs">{`Selection size: ${row.selectionSize}`}</span>
                  </>
                }
                value={`Peak ${modeLabel.toLowerCase()}: ${row.peak === null ? "N/A" : `${formatValue(row.peak, 3)}${unit ? ` ${unit}` : ""}`}`}
              />
            ))}
          </ol>
        )}
      </RankedSection>
    </div>
  );
}

export default DensityPanel;
