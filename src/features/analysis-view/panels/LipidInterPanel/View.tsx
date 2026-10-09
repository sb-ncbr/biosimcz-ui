"use client";

import { useMemo, useRef, useState } from "react";
import type { LipidInterData } from "@/entities/analysis";
import {
  ChartFrame,
  HeatmapChart,
  matrixToCsv,
  PanelIntro,
  RankedRow,
  RankedSection,
  StatStrip,
  type ChartHandle,
  type HeatmapScale,
} from "@/shared/viewers/echarts";
import type { PanelProps } from "../../model/registry";
import { unbinned } from "../membraneCommon";
import { PanelSelect } from "../PanelSelect";
import { effectiveChoice, formatValue } from "../structuralCommon";
import {
  ALL_LIPIDS,
  activeLipids,
  columnTotals,
  lipidInterSummary,
  matrixRows,
  peakValue,
  rowOrder,
  topLipids,
  topResidues,
  visibleLipids,
  type SortMode,
} from "./model";

const HEIGHT = 420;

const SORT_OPTIONS = [
  { value: "residue", label: "Residue number" },
  { value: "max", label: "Max occupancy" },
  { value: "total", label: "Total occupancy" },
] as const;

const SCALE: HeatmapScale = { kind: "continuous", min: 0 };

function LipidInterPanel({ data, context }: PanelProps<LipidInterData>) {
  const chart = useRef<ChartHandle>(null);
  const [chosenSort, setChosenSort] = useState<string | null>(null);
  const [chosenLipid, setChosenLipid] = useState<string | null>(null);
  const lipids = useMemo(() => activeLipids(data), [data]);
  const sort = effectiveChoice(chosenSort, SORT_OPTIONS.map((o) => o.value), "residue") as SortMode;
  const filter = effectiveChoice(chosenLipid, [ALL_LIPIDS, ...lipids.map((l) => l.key)], ALL_LIPIDS);
  const visible = useMemo(() => visibleLipids(lipids, filter), [lipids, filter]);
  const order = useMemo(() => rowOrder(visible, data.residues.length, sort), [visible, data.residues.length, sort]);
  const matrix = useMemo(() => unbinned(matrixRows(visible, order)), [visible, order]);
  const totals = useMemo(() => columnTotals(visible), [visible]);
  const xLabels = useMemo(() => visible.map((lipid) => lipid.label), [visible]);
  const yLabels = useMemo(() => order.map((row) => `Residue ${data.residues[row]}`), [order, data.residues]);
  const peak = useMemo(() => peakValue(visible), [visible]);
  const residues = useMemo(() => topResidues(visible, data.residues), [visible, data.residues]);
  const species = useMemo(() => topLipids(visible), [visible]);
  const lipidOptions = useMemo(
    () => [{ value: ALL_LIPIDS, label: "All lipids" }, ...lipids.map((lipid) => ({ value: lipid.key, label: lipid.label }))],
    [lipids],
  );
  const x = useMemo(() => ({ label: "Lipid" }), []);
  const y = useMemo(() => ({ label: "Residue" }), []);
  const value = useMemo(() => ({ label: "Occupancy" }), []);
  const tooltip = useMemo(
    () => (cell: { row: number; col: number; value: number }) => {
      const lipid = visible[cell.col];
      const total = totals[cell.col] ?? 0;
      return [
        { label: "Residue", value: String(data.residues[order[cell.row] ?? -1] ?? "-") },
        { label: "Lipid", value: lipid?.key ?? "-" },
        { label: "Occupancy", value: formatValue(cell.value, 2) },
        { label: "Share of lipid", value: total > 0 ? `${((cell.value / total) * 100).toFixed(1)}%` : "0.0%" },
      ];
    },
    [visible, totals, data.residues, order],
  );
  const stats = [
    { label: "Residues tracked", value: String(data.residues.length) },
    { label: "Lipid species", value: String(lipids.length) },
    { label: "Peak occupancy", value: formatValue(peak, 2) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PanelIntro
        title="Lipid interactions"
        description="Occupancy of each lipid species around the tracked residues, with the most interacting residues and species ranked alongside."
      />
      <StatStrip items={stats} label="Lipid interaction statistics" />
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ChartFrame
            title="Residue × lipid occupancy"
            description="Heatmap counts per residue with optional sorting and lipid filter"
            summary={lipidInterSummary(data.residues.length, lipids.length, peak)}
            filename={`${context.instanceId}-${context.analysisName}`}
            height={HEIGHT}
            chart={chart}
            csv={() => matrixToCsv(matrix, yLabels, visible.map((lipid) => lipid.key))}
            empty={visible.length === 0 ? { reason: "No lipid data available for the selected filter." } : null}
            actions={
              <>
                <PanelSelect label="Sort residues" value={sort} options={SORT_OPTIONS} onChange={setChosenSort} />
                <PanelSelect label="Lipid" value={filter} options={lipidOptions} onChange={setChosenLipid} />
              </>
            }
          >
            <HeatmapChart
              ref={chart}
              matrix={matrix}
              xLabels={xLabels}
              yLabels={yLabels}
              x={x}
              y={y}
              value={value}
              scale={SCALE}
              tooltip={tooltip}
              height={HEIGHT}
              ariaLabel="Occupancy per residue and lipid species"
            />
          </ChartFrame>
        </div>
        <div className="flex flex-col gap-4 lg:col-span-2">
          <RankedSection title="Top interacting residues" description="Ranked by cumulative lipid contact counts">
            {residues.length === 0 ? (
              <p className="text-text-muted text-sm">No residue interactions to highlight.</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {residues.map((r) => (
                  <RankedRow key={r.index} label={`Residue ${r.index}`} value={formatValue(r.total, 2)} />
                ))}
              </ol>
            )}
          </RankedSection>
          <RankedSection title="Top lipid species" description="Summed occupancies across all residues">
            {species.length === 0 ? (
              <p className="text-text-muted text-sm">No lipid species exceed the selected filter.</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {species.map((s) => (
                  <RankedRow key={s.key} label={s.label} value={formatValue(s.total, 2)} />
                ))}
              </ol>
            )}
          </RankedSection>
        </div>
      </div>
    </div>
  );
}

export default LipidInterPanel;
