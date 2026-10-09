"use client";

import { useMemo, useRef, useState } from "react";
import type { MemMapData } from "@/entities/analysis";
import { BarChart, ChartFrame, PanelIntro, RankedRow, RankedSection, StatStrip, type ChartHandle } from "@/shared/viewers/echarts";
import type { PanelProps } from "../../model/registry";
import { PanelSelect } from "../PanelSelect";
import { effectiveChoice } from "../structuralCommon";
import { ALL_MEMBRANES, countAll, membraneRows, memMapSummary, previewIndices } from "./model";

const HEIGHT = 420;

// Index lists can be long; the nested span lets them wrap inside RankedRow's no-wrap value cell.
const wrapped = (text: string) => <span className="inline-block max-w-full text-right break-words whitespace-normal">{text}</span>;

function MemMapPanel({ data, context }: PanelProps<MemMapData>) {
  const chart = useRef<ChartHandle>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const selected = effectiveChoice(chosen, [ALL_MEMBRANES, ...data.ids], ALL_MEMBRANES);
  const rows = useMemo(() => membraneRows(data, selected), [data, selected]);
  const multiple = data.ids.length > 1;
  const options = useMemo(
    () => [{ value: ALL_MEMBRANES, label: "All membranes" }, ...data.ids.map((id) => ({ value: id, label: `Membrane ${id}` }))],
    [data.ids],
  );
  const categories = useMemo(() => rows.map((row) => row.label), [rows]);
  const series = useMemo(
    () => [
      { name: "Top leaflet", data: rows.map((row) => row.top.length), stack: "leaflets" },
      { name: "Bottom leaflet", data: rows.map((row) => row.bottom.length), stack: "leaflets" },
    ],
    [rows],
  );
  const x = useMemo(() => ({ label: "Membrane" }), []);
  const y = useMemo(() => ({ label: "Lipid count" }), []);
  const tooltip = useMemo(
    () => (index: number) => {
      const row = rows[index];
      if (!row) return [];
      return [
        { label: "Top leaflet", value: String(row.top.length) },
        { label: "Top indices", value: previewIndices(row.top) },
        { label: "Bottom leaflet", value: String(row.bottom.length) },
        { label: "Bottom indices", value: previewIndices(row.bottom) },
      ];
    },
    [rows],
  );
  const stats = [
    { label: "Membranes shown", value: String(rows.length) },
    { label: "Top lipids", value: String(countAll(rows, "top")) },
    { label: "Bottom lipids", value: String(countAll(rows, "bottom")) },
  ];
  const polar = rows.flatMap((row) => [
    { key: `${row.id}-top`, label: multiple ? `${row.label}, top leaflet` : "Top leaflet", value: previewIndices(row.polarTop, 8) },
    { key: `${row.id}-bottom`, label: multiple ? `${row.label}, bottom leaflet` : "Bottom leaflet", value: previewIndices(row.polarBottom, 8) },
  ]);
  const unassigned = data.no_mem_lipid.length > 0 ? [{ key: "unassigned", label: "Indices", value: previewIndices(data.no_mem_lipid, 10) }] : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <PanelIntro
          title="Membrane leaflet composition"
          description="Stacked counts of top vs bottom leaflet assignments per membrane"
        />
        <PanelSelect label="Filter membranes" value={selected} options={options} onChange={setChosen} />
      </div>
      <StatStrip items={stats} label="Membrane statistics" />
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ChartFrame
            title="Leaflet assignments"
            description="Lipid count per leaflet; the indices are residue indices as reported upstream"
            summary={memMapSummary(rows)}
            filename={`${context.instanceId}-${context.analysisName}`}
            height={HEIGHT}
            chart={chart}
            csv={() =>
              ["membrane,top_leaflet,bottom_leaflet", ...rows.map((row) => `${row.label},${row.top.length},${row.bottom.length}`)].join("\n")
            }
            empty={rows.length === 0 ? { reason: "No leaflet assignments provided for the selected membrane." } : null}
          >
            <BarChart
              ref={chart}
              categories={categories}
              series={series}
              x={x}
              y={y}
              tooltip={tooltip}
              height={HEIGHT}
              ariaLabel="Lipids in the top and bottom leaflet per membrane"
            />
          </ChartFrame>
        </div>
        <div className="flex flex-col gap-4 lg:col-span-2">
          <RankedSection title="Polar atom indices" description="Per-leaflet polar selections to validate leaflet detection">
            {polar.length === 0 ? (
              <p className="text-text-muted text-sm">No polar atom assignments available for the selected membrane.</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {polar.map((item) => (
                  <RankedRow key={item.key} label={item.label} value={wrapped(item.value)} />
                ))}
              </ol>
            )}
          </RankedSection>
          <RankedSection title="Unassigned lipids" description="Lipids without a leaflet assignment (no_mem_lipid bucket)">
            {unassigned.length === 0 ? (
              <p className="text-text-muted text-sm">No unassigned lipids reported.</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {unassigned.map((item) => (
                  <RankedRow key={item.key} label={item.label} value={wrapped(item.value)} />
                ))}
              </ol>
            )}
          </RankedSection>
        </div>
      </div>
    </div>
  );
}

export default MemMapPanel;
