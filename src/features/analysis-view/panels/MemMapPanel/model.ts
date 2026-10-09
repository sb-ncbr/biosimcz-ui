import type { MemMapData } from "@/entities/analysis";

const ALL_MEMBRANES = "all";
const PREVIEW_LIMIT = 12;

type MembraneRow = {
  id: string;
  label: string;
  top: readonly number[];
  bottom: readonly number[];
  polarTop: readonly number[];
  polarBottom: readonly number[];
};

const membraneLabel = (id: string): string => `Membrane ${id}`;

const membraneRows = (data: MemMapData, selected: string): MembraneRow[] =>
  data.ids
    .filter((id) => selected === ALL_MEMBRANES || id === selected)
    .map((id) => {
      const mem = data.mems[id]!;
      return {
        id,
        label: membraneLabel(id),
        top: mem.leaflets.top,
        bottom: mem.leaflets.bot,
        polarTop: mem.polar_atoms.top,
        polarBottom: mem.polar_atoms.bot,
      };
    });

const previewIndices = (values: readonly number[], limit = PREVIEW_LIMIT): string => {
  if (values.length === 0) return "None recorded";
  const shown = values.slice(0, limit).join(", ");
  return values.length > limit ? `${shown}, +${values.length - limit} more` : shown;
};

const countAll = (rows: readonly MembraneRow[], side: "top" | "bottom"): number => {
  let total = 0;
  for (const row of rows) total += row[side].length;
  return total;
};

const memMapSummary = (rows: readonly MembraneRow[]): string =>
  rows.length === 0
    ? "No membranes to show"
    : `${rows.length} membrane${rows.length === 1 ? "" : "s"}: ${countAll(rows, "top")} entries in the top leaflet, ${countAll(rows, "bottom")} in the bottom leaflet.`;

export { ALL_MEMBRANES, countAll, membraneRows, memMapSummary, previewIndices };
