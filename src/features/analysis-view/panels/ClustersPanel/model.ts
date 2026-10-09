import type { ClustersData } from "@/entities/analysis";
import { binMatrix, type BinnedMatrix } from "@/shared/viewers/echarts";

const MAX_VISIBLE_CLUSTERS = 20;
const MAX_TOP_TRANSITIONS = 6;
const HEATMAP_TARGET = 512;

type ClusterBar = {
  index: number;
  label: string;
  frames: number;
  main: number;
};
type Transition = { from: number; to: number; count: number };

const clusterLabel = (index: number): string => `Cluster ${index + 1}`;

// Same wording as the old UI: the representative frame follows the 1-based position.
const clusterTitle = (index: number, main?: number): string =>
  typeof main === "number" && Number.isFinite(main) ? `Cluster ${index + 1} (frame ${main})` : clusterLabel(index);

// from/to semantics are UNKNOWN upstream: a value inside [0, N) is a cluster position, anything else is looked up by main frame, as the old UI did.
const resolveClusterIndex = (data: ClustersData, value: number): number => {
  if (Number.isInteger(value) && value >= 0 && value < data.clusters.length) return value;
  return data.clusters.findIndex((cluster) => cluster.main === value);
};

const totalFrames = (data: ClustersData): number => {
  let total = 0;
  for (const cluster of data.clusters) total += cluster.frames.length;
  return total;
};

// Largest first, top 20; the label carries the 1-based position the heatmap axes use.
const clusterBars = (data: ClustersData, limit = MAX_VISIBLE_CLUSTERS): ClusterBar[] =>
  data.clusters
    .map((cluster, index) => ({
      index,
      label: clusterTitle(index, cluster.main),
      frames: cluster.frames.length,
      main: cluster.main,
    }))
    .sort((a, b) => b.frames - a.frames)
    .slice(0, limit);

// Transitions that point at an unknown cluster are dropped.
const resolvedTransitions = (data: ClustersData): Transition[] => {
  const out: Transition[] = [];
  for (const transition of data.transitions) {
    const from = resolveClusterIndex(data, transition.from);
    const to = resolveClusterIndex(data, transition.to);
    if (from >= 0 && to >= 0) out.push({ from, to, count: transition.count });
  }
  return out;
};

// Rows are the origin, columns the destination; repeated pairs add up.
const transitionMatrix = (data: ClustersData, transitions: readonly Transition[]): BinnedMatrix => {
  const size = data.clusters.length;
  const counts = Array.from({ length: size }, () => new Array<number>(size).fill(0));
  for (const { from, to, count } of transitions) counts[from]![to] = counts[from]![to]! + count;
  return binMatrix(counts, HEATMAP_TARGET);
};

const topTransitions = (transitions: readonly Transition[], limit = MAX_TOP_TRANSITIONS): Transition[] => {
  const merged = new Map<string, Transition>();
  for (const t of transitions) {
    const key = `${t.from}:${t.to}`;
    const known = merged.get(key);
    merged.set(key, known ? { ...known, count: known.count + t.count } : { ...t });
  }
  return [...merged.values()]
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
};

// A binned cell covers a range of clusters; a single cluster reads as its label.
const rangeText = (range: readonly [number, number] | undefined, mains?: readonly number[]): string => {
  if (!range) return "-";
  return range[0] === range[1] ? clusterTitle(range[0], mains?.[range[0]]) : `${clusterLabel(range[0])} to ${clusterLabel(range[1])}`;
};

const clustersSummary = (data: ClustersData): string =>
  `${data.clusters.length} clusters covering ${totalFrames(data)} frames at cutoff ${data.cutoff}.`;

export {
  clusterBars,
  clusterLabel,
  clusterTitle,
  clustersSummary,
  rangeText,
  resolveClusterIndex,
  resolvedTransitions,
  topTransitions,
  totalFrames,
  transitionMatrix,
};
