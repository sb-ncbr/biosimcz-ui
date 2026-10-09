import type { LipidOrderData, LipidOrderSegment } from "@/entities/analysis";
import { summarize, type LineSeries, type Stats, type XY } from "@/shared/viewers/echarts";
import { bandOf } from "../membraneCommon";

const lipidNames = (data: LipidOrderData): string[] => Object.keys(data.data);

const segmentNames = (data: LipidOrderData, lipid: string): string[] => Object.keys(data.data[lipid] ?? {});

const segmentOf = (data: LipidOrderData, lipid: string, segment: string): LipidOrderSegment | null =>
  data.data[lipid]?.[segment] ?? null;

// Positions are 1-based along the chain; atom names are listed separately because the x axis is numeric.
const orderSeries = (segment: LipidOrderSegment | null): LineSeries[] => {
  if (!segment || segment.avg.length === 0) return [];
  const xs = segment.avg.map((_, index) => index + 1);
  const points = segment.avg.map((value, index): XY => [xs[index]!, value]);
  const band = bandOf(xs, segment.avg, segment.std);
  return [{ name: "Average S", data: points, ...(band ? { band } : {}) }];
};

type OrderStats = { positions: number; avg: Stats | null; std: Stats | null };

const orderStats = (segment: LipidOrderSegment | null): OrderStats => ({
  positions: segment?.avg.length ?? 0,
  avg: segment ? summarize(segment.avg) : null,
  std: segment ? summarize(segment.std) : null,
});

const orderSummary = (lipid: string, segment: string, stats: OrderStats): string =>
  stats.avg
    ? `${lipid} ${segment}: ${stats.positions} positions, mean S ${stats.avg.mean.toFixed(3)}, max S ${stats.avg.max.toFixed(3)}.`
    : "No finite order parameters";

const emptyReason = (lipids: number, segments: number): string =>
  lipids === 0 ? "No lipid order data available." : segments === 0 ? "The selected lipid does not contain usable segment data." : "No order values for this segment";

export { emptyReason, lipidNames, orderStats, orderSeries, orderSummary, segmentNames, segmentOf };
