"use client";

import { useMemo, useRef, useState } from "react";
import type { LipidOrderData } from "@/entities/analysis";
import { ChartFrame, LineChart, PanelIntro, RankedSection, seriesToCsv, StatStrip, type ChartHandle } from "@/shared/viewers/echarts";
import { Badge } from "@/shared/ui";
import type { PanelProps } from "../../model/registry";
import { PanelSelect } from "../PanelSelect";
import { effectiveChoice, formatValue } from "../structuralCommon";
import { emptyReason, lipidNames, orderSeries, orderStats, orderSummary, segmentNames, segmentOf } from "./model";

const HEIGHT = 420;

const toOptions = (names: readonly string[]) => names.map((name) => ({ value: name, label: name }));

const statValue = (value: number | undefined): string => (value === undefined ? "N/A" : formatValue(value));

function LipidOrderPanel({ data, context }: PanelProps<LipidOrderData>) {
  const chart = useRef<ChartHandle>(null);
  const [chosenLipid, setChosenLipid] = useState<string | null>(null);
  const [chosenSegment, setChosenSegment] = useState<string | null>(null);
  const lipids = useMemo(() => lipidNames(data), [data]);
  const lipid = effectiveChoice(chosenLipid, lipids, null);
  const segments = useMemo(() => segmentNames(data, lipid), [data, lipid]);
  const segmentKey = effectiveChoice(chosenSegment, segments, null);
  const segment = useMemo(() => segmentOf(data, lipid, segmentKey), [data, lipid, segmentKey]);
  const series = useMemo(() => orderSeries(segment), [segment]);
  const stats = useMemo(() => orderStats(segment), [segment]);
  const x = useMemo(() => ({ label: "Position along chain" }), []);
  const y = useMemo(() => ({ label: "S", scale: true }), []);
  const items = [
    { label: "Positions", value: String(stats.positions) },
    { label: "Avg S", value: statValue(stats.avg?.mean) },
    { label: "Max S", value: statValue(stats.avg?.max) },
    { label: "Avg std", value: statValue(stats.std?.mean) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <PanelIntro
          title="Lipid order parameters"
          description="Inspect segment order (S) per carbon and compare the standard deviation envelope."
        />
        <div className="flex flex-wrap gap-2">
          <PanelSelect label="Lipid" value={lipid} options={toOptions(lipids)} onChange={setChosenLipid} />
          <PanelSelect label="Segment" value={segmentKey} options={toOptions(segments)} onChange={setChosenSegment} />
        </div>
      </div>
      <StatStrip items={items} label="Order parameter statistics" />
      <ChartFrame
        title="Segment order profile"
        description="Average S with upper/lower bounds derived from the reported standard deviations."
        badge={segmentKey || undefined}
        summary={orderSummary(lipid, segmentKey, stats)}
        filename={`${context.instanceId}-${context.analysisName}-${lipid}-${segmentKey}`}
        height={HEIGHT}
        chart={chart}
        csv={() => seriesToCsv(series, "position")}
        empty={series.length === 0 ? { reason: emptyReason(lipids.length, segments.length) } : null}
      >
        <LineChart ref={chart} series={series} x={x} y={y} legend height={HEIGHT} ariaLabel={`Order parameter along ${lipid} ${segmentKey}`} />
      </ChartFrame>
      <RankedSection title="Atom labels">
        {segment && segment.atoms.length > 0 ? (
          <ol className="flex flex-wrap gap-2">
            {segment.atoms.map((atom, index) => (
              <li key={`${index}-${atom}`}>
                <Badge variant="secondary">{`${index + 1}. ${atom}`}</Badge>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-text-muted text-sm">No atom names were provided for this segment.</p>
        )}
      </RankedSection>
    </div>
  );
}

export default LipidOrderPanel;
