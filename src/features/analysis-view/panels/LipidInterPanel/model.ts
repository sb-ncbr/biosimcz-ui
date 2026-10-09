import type { LipidInterData } from "@/entities/analysis";

const ALL_LIPIDS = "all";
const LABEL_LIMIT = 16;
const TOP_COUNT = 5;

type SortMode = "residue" | "max" | "total";
type Lipid = { key: string; label: string; values: readonly number[] };

// Values are NaN where the payload was shorter than the residue list; they count as no interaction.
const finiteOrZero = (value: number | undefined): number => (value !== undefined && Number.isFinite(value) ? value : 0);

// Species whose values are all zero add empty columns, so they are dropped (as in the old panel).
const hasInteraction = (values: readonly number[]): boolean => {
  for (const value of values) if (finiteOrZero(value) !== 0) return true;
  return false;
};

// A truncated InChI key can collide with another one, so duplicates get an ordinal suffix.
const lipidLabels = (keys: readonly string[]): string[] => {
  const short = keys.map((key) => (key.length > LABEL_LIMIT ? `${key.slice(0, LABEL_LIMIT)}...` : key));
  const total = new Map<string, number>();
  for (const label of short) total.set(label, (total.get(label) ?? 0) + 1);
  const seen = new Map<string, number>();
  return short.map((label) => {
    if (total.get(label) === 1) return label;
    const ordinal = (seen.get(label) ?? 0) + 1;
    seen.set(label, ordinal);
    return `${label} #${ordinal}`;
  });
};

const activeLipids = (data: LipidInterData): Lipid[] => {
  const kept = data.lipids.filter((lipid) => hasInteraction(lipid.values));
  const labels = lipidLabels(kept.map((lipid) => lipid.key));
  return kept.map((lipid, index) => ({ key: lipid.key, label: labels[index]!, values: lipid.values }));
};

const visibleLipids = (lipids: readonly Lipid[], filter: string): Lipid[] =>
  filter === ALL_LIPIDS ? [...lipids] : lipids.filter((lipid) => lipid.key === filter);

const rowStats = (lipids: readonly Lipid[], row: number): { max: number; total: number } => {
  let max = -Infinity;
  let total = 0;
  for (const lipid of lipids) {
    const value = finiteOrZero(lipid.values[row]);
    if (value > max) max = value;
    total += value;
  }
  return { max: max === -Infinity ? 0 : max, total };
};

// Returns source row indices; the residue list itself is never reordered in place.
const rowOrder = (lipids: readonly Lipid[], rows: number, mode: SortMode): number[] => {
  const order = Array.from({ length: rows }, (_, index) => index);
  if (mode === "residue") return order;
  const keys = order.map((row) => rowStats(lipids, row)[mode]);
  return order.sort((a, b) => keys[b]! - keys[a]!);
};

const matrixRows = (lipids: readonly Lipid[], order: readonly number[]): number[][] =>
  order.map((row) => lipids.map((lipid) => finiteOrZero(lipid.values[row])));

const columnTotals = (lipids: readonly Lipid[]): number[] =>
  lipids.map((lipid) => {
    let total = 0;
    for (const value of lipid.values) total += finiteOrZero(value);
    return total;
  });

const peakValue = (lipids: readonly Lipid[]): number | null => {
  let peak = -Infinity;
  for (const lipid of lipids) for (const value of lipid.values) if (Number.isFinite(value) && value > peak) peak = value;
  return peak === -Infinity ? null : peak;
};

const topResidues = (lipids: readonly Lipid[], residues: readonly number[], limit = TOP_COUNT): { index: number; total: number }[] =>
  residues
    .map((_, row) => ({ index: residues[row]!, total: rowStats(lipids, row).total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);

const topLipids = (lipids: readonly Lipid[], limit = TOP_COUNT): { key: string; label: string; total: number }[] => {
  const totals = columnTotals(lipids);
  return lipids
    .map((lipid, index) => ({ key: lipid.key, label: lipid.label, total: totals[index]! }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
};

const lipidInterSummary = (residues: number, species: number, peak: number | null): string =>
  species === 0
    ? "No lipid species with a non-zero interaction"
    : `${residues} residues, ${species} lipid species${peak === null ? "" : `, peak value ${peak.toFixed(2)}`}.`;

export {
  ALL_LIPIDS,
  activeLipids,
  columnTotals,
  lipidInterSummary,
  lipidLabels,
  matrixRows,
  peakValue,
  rowOrder,
  topLipids,
  topResidues,
  visibleLipids,
};
export type { SortMode };
