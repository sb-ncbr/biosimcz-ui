"use client";

import { useMemo, useRef } from "react";
import type { AplData, UnitLabel } from "@/entities/analysis";
import {
  ChartFrame,
  HeatmapChart,
  LineChart,
  matrixToCsv,
  PanelIntro,
  seriesToCsv,
  StatStrip,
  type ChartHandle,
  type HeatmapScale,
} from "@/shared/viewers/echarts";
import type { PanelProps } from "../../model/registry";
import { unbinned } from "../membraneCommon";
import { formatValue, unitFor, unitText } from "../structuralCommon";
import { aplStats, aplSummary, gridLabels, gridResolution, medianSeries, sharedRange } from "./model";

const HEIGHT = 420;

type LeafletMapProps = {
  title: string;
  description: string;
  emptyReason: string;
  matrix: readonly (readonly number[])[];
  data: AplData;
  range: { min: number; max: number } | null;
  filename: string;
  unit: UnitLabel | null;
};

function LeafletMap({ title, description, emptyReason, matrix, data, range, filename, unit }: LeafletMapProps) {
  const chart = useRef<ChartHandle>(null);
  const binned = useMemo(() => unbinned(matrix), [matrix]);
  const xLabels = useMemo(() => gridLabels(data.gridX, binned.cols, "X"), [data.gridX, binned.cols]);
  const yLabels = useMemo(() => gridLabels(data.gridY, binned.rows, "Y"), [data.gridY, binned.rows]);
  const scale = useMemo<HeatmapScale>(() => ({ kind: "continuous", ...(range ?? {}) }), [range]);
  const x = useMemo(() => ({ label: "Grid X" }), []);
  const y = useMemo(() => ({ label: "Grid Y" }), []);
  const value = useMemo(() => ({ label: "Area per lipid", unit }), [unit]);
  const empty = matrix.length === 0 ? { reason: emptyReason } : null;

  return (
    <ChartFrame
      title={title}
      description={description}
      summary={matrix.length === 0 ? "No grid data" : `${binned.cols} x ${binned.rows} grid cells`}
      filename={filename}
      height={HEIGHT}
      chart={chart}
      csv={() => matrixToCsv(binned, yLabels, xLabels)}
      empty={empty}
    >
      <HeatmapChart
        ref={chart}
        matrix={binned}
        xLabels={xLabels}
        yLabels={yLabels}
        x={x}
        y={y}
        value={value}
        scale={scale}
        height={HEIGHT}
        ariaLabel={`${title} area per lipid map`}
      />
    </ChartFrame>
  );
}

function AplPanel({ data, context }: PanelProps<AplData>) {
  const lineChart = useRef<ChartHandle>(null);
  const filename = `${context.instanceId}-${context.analysisName}`;
  const unit = unitFor(context.analysisName, "value");
  const range = useMemo(() => sharedRange(data), [data]);
  const stats = useMemo(() => aplStats(data), [data]);
  const series = useMemo(() => medianSeries(data), [data]);
  const x = useMemo(() => ({ label: "Frame", scale: true }), []);
  const y = useMemo(() => ({ label: "Area per lipid", unit, scale: true }), [unit]);
  const text = unitText(unit);
  const withUnit = text ? { unit: text } : {};
  const items = [
    { label: "Median area", value: formatValue(stats.median?.mean, 2), ...withUnit },
    { label: "Std. deviation", value: formatValue(stats.std?.mean, 2), ...withUnit },
    { label: "Grid resolution", value: gridResolution(data) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PanelIntro
        title="Area per lipid"
        description="Per-cell area contributions for each leaflet, with the median and its spread over frames. Both maps share one colour range."
      />
      <StatStrip items={items} label="Area per lipid statistics" />
      {series.length > 0 ? (
        <ChartFrame
          title="Median ± Std over frames"
          description="The shaded band is the median plus and minus one standard deviation"
          summary={aplSummary(stats.median, data.median.length)}
          filename={`${filename}-median`}
          height={HEIGHT}
          chart={lineChart}
          csv={() => seriesToCsv(series, "frame")}
        >
          <LineChart ref={lineChart} series={series} x={x} y={y} legend height={HEIGHT} ariaLabel="Median area per lipid over frames" />
        </ChartFrame>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <LeafletMap
          title="Upper leaflet grid"
          description="Per-cell area contributions for the upper leaflet"
          emptyReason="No upper leaflet grid data provided."
          matrix={data.upper} data={data} range={range} filename={`${filename}-upper`} unit={unit} />
        <LeafletMap
          title="Lower leaflet grid"
          description="Mirrored area map for the lower leaflet"
          emptyReason="No lower leaflet grid data provided."
          matrix={data.lower} data={data} range={range} filename={`${filename}-lower`} unit={unit} />
      </div>
    </div>
  );
}

export default AplPanel;
