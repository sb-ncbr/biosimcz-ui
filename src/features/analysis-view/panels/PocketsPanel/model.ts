import type { PocketsData } from "@/entities/analysis";
import { summarize, type Stats, type XY } from "@/shared/viewers/echarts";

const MAX_BAR_POCKETS = 15;

type PocketSummary = {
  id: string;
  name: string;
  stats: Stats | null;
  atoms: number;
};

const summarizePockets = (data: PocketsData): PocketSummary[] =>
  data.data.map((pocket, index) => ({
    // The index keeps ids unique when two pockets share a name.
    id: String(index),
    name: pocket.name,
    stats: summarize(pocket.volumes),
    atoms: pocket.atoms.length,
  }));

// Largest first: the horizontal bar chart lists its first category at the top.
const rankPockets = (pockets: readonly PocketSummary[], limit = MAX_BAR_POCKETS): PocketSummary[] =>
  pockets
    .filter((pocket) => pocket.stats !== null)
    .sort((a, b) => b.stats!.mean - a.stats!.mean)
    .slice(0, limit);

// NaN volumes (missing samples) stay in the series so the line breaks instead of bridging the gap.
const volumeSeries = (volumes: readonly number[], start: number, step: number): XY[] =>
  volumes.map((volume, index): XY => [start + index * step, volume]);

const pocketsSummary = (pockets: readonly PocketSummary[], frames: number): string =>
  pockets.length === 0 ? "No pockets in this analysis" : `${pockets.length} pockets tracked over ${frames} frames.`;

export { MAX_BAR_POCKETS, pocketsSummary, rankPockets, summarizePockets, volumeSeries };
