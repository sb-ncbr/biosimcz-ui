"use client";

import { useMemo, useRef } from "react";
import type { ThicknessData } from "@/entities/analysis";
import { ChartFrame, LineChart, PanelIntro, RankedRow, RankedSection, seriesToCsv, StatStrip, type ChartHandle } from "@/shared/viewers/echarts";
import type { PanelProps } from "../../model/registry";
import { formatValue, unitFor, unitText } from "../structuralCommon";
import { leafletSeries, midplaneSeries, thicknessStats, thicknessSummary } from "./model";

const HEIGHT = 420;

function ThicknessPanel({ data, context }: PanelProps<ThicknessData>) {
  const mainChart = useRef<ChartHandle>(null);
  const midplaneChart = useRef<ChartHandle>(null);
  const filename = `${context.instanceId}-${context.analysisName}`;
  const unit = unitFor(context.analysisName, "y");
  const text = unitText(unit);
  const withUnit = text ? { unit: text } : {};
  const stats = useMemo(() => thicknessStats(data), [data]);
  const main = useMemo(() => leafletSeries(data), [data]);
  const midplane = useMemo(() => midplaneSeries(data), [data]);
  const x = useMemo(() => ({ label: "Frame", scale: true }), []);
  const y = useMemo(() => ({ label: "Distance", unit, scale: true }), [unit]);
  const yMidplane = useMemo(() => ({ label: "Midplane Z", unit, scale: true }), [unit]);
  const range =
    stats.thickness === null ? "-" : `${formatValue(stats.thickness.min, 2)}–${formatValue(stats.thickness.max, 2)}`;
  const items = [
    { label: "Average thickness", value: formatValue(stats.thickness?.mean, 2), ...withUnit },
    { label: "Thickness range", value: range, ...withUnit },
    { label: "Avg thickness σ", value: formatValue(stats.std?.mean, 2), ...withUnit },
    { label: "Frames analyzed", value: data.frame.length > 0 ? String(data.frame.length) : "-" },
  ];
  const snapshot = [
    { label: "Leaflet gap (avg)", value: stats.gap },
    { label: "σ (positive leaflet)", value: stats.stdPositive?.mean },
    { label: "σ (negative leaflet)", value: stats.stdNegative?.mean },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PanelIntro
        title="Membrane thickness"
        description="Overall thickness and leaflet centroid positions per frame, with the midplane drift and a stability snapshot."
      />
      <StatStrip items={items} label="Membrane thickness statistics" />
      <ChartFrame
        title="Leaflet separation over time"
        description="Overall thickness with positive/negative leaflet centroids"
        summary={thicknessSummary(stats, data.thickness.length)}
        filename={`${filename}-thickness`}
        height={HEIGHT}
        chart={mainChart}
        csv={() => seriesToCsv(main, "frame")}
        empty={main.length === 0 ? { reason: "No membrane thickness analysis data available." } : null}
      >
        <LineChart ref={mainChart} series={main} x={x} y={y} legend height={HEIGHT} ariaLabel="Membrane thickness and leaflet positions over frames" />
      </ChartFrame>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame
          title="Midplane drift"
          description="Z-position of the bilayer midplane per frame"
          summary={midplane.length > 0 ? `Midplane position over ${data.midplane_z?.length ?? 0} frames.` : "No midplane data"}
          filename={`${filename}-midplane`}
          height={HEIGHT}
          chart={midplaneChart}
          csv={() => seriesToCsv(midplane, "frame")}
          empty={midplane.length === 0 ? { reason: "No midplane data provided." } : null}
        >
          <LineChart ref={midplaneChart} series={midplane} x={x} y={yMidplane} height={HEIGHT} ariaLabel="Membrane midplane position over frames" />
        </ChartFrame>
        <RankedSection
          title="Stability snapshot"
          description="Average standard deviations for each leaflet and the combined thickness"
        >
          <ol className="flex flex-col gap-2">
            {snapshot.map((row) => (
              <RankedRow key={row.label} label={row.label} value={`${formatValue(row.value, 2)}${text ? ` ${text}` : ""}`} />
            ))}
          </ol>
        </RankedSection>
      </div>
    </div>
  );
}

export default ThicknessPanel;
