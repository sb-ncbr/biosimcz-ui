import type { SasaData } from "@/entities/analysis";
import { summarize, type Stats, type XY } from "@/shared/viewers/echarts";

const MAX_BAR_RESIDUES = 25;

type ResidueSummary = { index: number; label: string; stats: Stats | null };

// Residue names are not in the payload; the 1-based row number is the only identity (plan X7 is deferred).
const residueLabel = (index: number): string => `Residue ${index + 1}`;

const summarizeResidues = (data: SasaData): ResidueSummary[] =>
  data.perResidue.map((values, index) => ({ index, label: residueLabel(index), stats: summarize(values) }));

// Largest first: the horizontal bar chart lists its first category at the top.
const rankResidues = (residues: readonly ResidueSummary[], limit = MAX_BAR_RESIDUES): ResidueSummary[] =>
  residues
    .filter((residue) => residue.stats !== null)
    .sort((a, b) => b.stats!.mean - a.stats!.mean)
    .slice(0, limit);

const toPoints = (values: ArrayLike<number>, step: number): XY[] => {
  const points = new Array<XY>(values.length);
  for (let i = 0; i < values.length; i++) points[i] = [i * step, values[i]!];
  return points;
};

const sasaSummary = (residues: number, frames: number, total: Stats | null): string =>
  total
    ? `${residues} residues over ${frames} samples; total mean ${total.mean.toFixed(1)}, min ${total.min.toFixed(1)}, max ${total.max.toFixed(1)}.`
    : "No finite SASA samples";

export { MAX_BAR_RESIDUES, rankResidues, residueLabel, sasaSummary, summarizeResidues, toPoints };
