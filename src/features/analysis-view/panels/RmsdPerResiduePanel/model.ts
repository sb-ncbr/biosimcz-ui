import type { RmsdPerResidueData } from "@/entities/analysis";
import { summarize, type LineSeries, type Stats } from "@/shared/viewers/echarts";
import { statsSentence, toPoints, unitFor } from "../timeSeriesCommon";

// Residues are addressed by index, not name: names can repeat and would collide as select values.
const effectiveResidue = (count: number, selected: number | null): number | null =>
  count === 0 ? null : selected !== null && selected >= 0 && selected < count ? selected : 0;

type RmsdPerResidueModel = {
  index: number | null;
  name: string | null;
  lines: LineSeries[];
  stats: Stats | null;
  summary: string;
  emptyReason: string | null;
};

const buildRmsdPerResidueModel = (data: RmsdPerResidueData, selected: number | null, analysisName: string): RmsdPerResidueModel => {
  const index = effectiveResidue(data.residues.length, selected);
  const residue = index === null ? null : data.residues[index]!;
  const unit = unitFor(analysisName, "y");
  const stats = residue ? summarize(residue.values) : null;
  const hasPoints = (residue?.values.length ?? 0) > 0;

  return {
    index,
    name: residue?.name ?? null,
    lines: residue ? [{ name: residue.name, data: toPoints(residue.values, 0, data.step) }] : [],
    stats,
    summary: residue ? statsSentence(residue.name, stats, unit) : "No residues in this analysis",
    emptyReason: hasPoints ? null : "No RMSD per residue data available.",
  };
};

export { buildRmsdPerResidueModel, effectiveResidue };
