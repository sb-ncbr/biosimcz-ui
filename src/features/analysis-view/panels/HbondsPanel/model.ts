import type { HbondsData } from "@/entities/analysis";
import { binMatrix, rangeLabels, summarize, type BinnedMatrix, type Stats, type TooltipRow, type XY } from "@/shared/viewers/echarts";
import { matrixWidth, percent } from "../matricesCommon";
import type { PanelSelectOption } from "../PanelSelect";
import type { RankedItem } from "../RankedList";
import { formatValue } from "../timeSeriesCommon";

type HbondEntry = HbondsData["interactions"][number];

const HBOND_TARGET = 400;
const TOP_BONDS = 6;

const interactionOptions = (data: HbondsData): PanelSelectOption[] =>
  data.interactions.map((entry, index) => ({ value: String(index), label: entry.name }));

// Atom indices only; a missing or non-finite index shows as "?" rather than a fake number.
const atomText = (prefix: string, values: readonly number[], index: number): string => {
  const value = values[index];
  return `${prefix} ${value !== undefined && Number.isFinite(value) ? value : "?"}`;
};

const describeBond = (entry: HbondEntry, index: number): string =>
  `${atomText("D", entry.donors, index)} -> ${atomText("A", entry.acceptors, index)} (${atomText("H", entry.hydrogens, index)})`;

// Highest occupancy first; a partial selection keeps this linear in the number of bonds.
const topBonds = (entry: HbondEntry, limit = TOP_BONDS): RankedItem[] => {
  const picked: number[] = [];
  for (let i = 0; i < entry.occupancy.length; i++) {
    const value = entry.occupancy[i]!;
    if (!Number.isFinite(value)) continue;
    if (picked.length === limit && value <= entry.occupancy[picked[limit - 1]!]!) continue;
    let at = picked.length;
    while (at > 0 && value > entry.occupancy[picked[at - 1]!]!) at--;
    picked.splice(at, 0, i);
    if (picked.length > limit) picked.pop();
  }
  return picked.map((i) => ({ key: String(i), label: `Bond ${i + 1}: ${describeBond(entry, i)}`, value: percent(entry.occupancy[i]!) }));
};

// Live values are fractions per time block, so the column sum is the average number of bonds formed in that block.
const bondsPerBlock = (timed: readonly ArrayLike<number>[]): XY[] => {
  const blocks = matrixWidth(timed);
  const sums = new Float64Array(blocks);
  for (let r = 0; r < timed.length; r++) {
    const row = timed[r]!;
    for (let c = 0; c < blocks; c++) {
      const v = row[c]!;
      if (Number.isFinite(v)) sums[c] = sums[c]! + v;
    }
  }
  const points = new Array<XY>(blocks);
  for (let c = 0; c < blocks; c++) points[c] = [c + 1, sums[c]!];
  return points;
};

type HbondsModel = {
  options: PanelSelectOption[];
  interactionId: string;
  name: string | null;
  bonds: number;
  blocks: number;
  heat: BinnedMatrix | null;
  line: XY[];
  formed: Stats | null;
  top: RankedItem[];
  rowLabels: string[];
  colLabels: string[];
  heatEmpty: string | null;
  lineEmpty: string | null;
  summary: string;
  entry: HbondEntry | null;
};

const buildHbondsModel = (data: HbondsData, chosen: string | null): HbondsModel => {
  const options = interactionOptions(data);
  const interactionId = chosen !== null && data.interactions[Number(chosen)] ? chosen : data.interactions.length > 0 ? "0" : "";
  const entry = data.interactions[Number(interactionId)] ?? null;
  if (!entry) {
    const reason = "No hydrogen bond data in this analysis";
    return {
      options, interactionId, name: null, bonds: 0, blocks: 0, heat: null, line: [], formed: null, top: [],
      rowLabels: [], colLabels: [], heatEmpty: reason, lineEmpty: reason, summary: reason, entry: null,
    };
  }

  const bonds = entry.occupancy.length || entry.timed.length;
  const blocks = matrixWidth(entry.timed);
  const hasTimed = bonds > 0 && blocks > 0;
  const heat = hasTimed ? binMatrix(entry.timed, HBOND_TARGET) : null;
  const line = hasTimed ? bondsPerBlock(entry.timed) : [];
  const formed = summarize(line.map((point) => point[1]));
  const timedReason = "This interaction has occupancy totals but no per-block series";
  const top = topBonds(entry);

  return {
    options,
    interactionId,
    name: entry.name,
    bonds,
    blocks,
    heat,
    line,
    formed,
    top,
    rowLabels: heat ? rangeLabels(heat.rowRanges, 1, 1, "Bond ") : [],
    colLabels: heat ? rangeLabels(heat.colRanges, 1, 1, "") : [],
    heatEmpty: heat ? null : bonds === 0 ? "No hydrogen bonds in this interaction" : timedReason,
    lineEmpty: line.length > 0 ? null : bonds === 0 ? "No hydrogen bonds in this interaction" : timedReason,
    summary: `${entry.name}: ${bonds} bonds over ${blocks} time blocks${
      formed ? `, on average ${formatValue(formed.mean, 1)} bonds formed per block (max ${formatValue(formed.max, 1)})` : ""
    }${top[0] ? `; most persistent ${top[0].label} at ${top[0].value}` : ""}.`,
    entry,
  };
};

const hbondsTooltip =
  (model: HbondsModel) =>
  ({ row, col, value }: { row: number; col: number; value: number }): TooltipRow[] => {
    const range = model.heat?.rowRanges[row];
    const single = model.entry && range && range[0] === range[1] ? describeBond(model.entry, range[0]) : null;
    return [
      { label: "Bond", value: model.rowLabels[row] ?? String(row + 1) },
      ...(single ? [{ label: "Atoms", value: single }] : []),
      { label: "Time block", value: model.colLabels[col] ?? String(col + 1) },
      { label: "Occupancy", value: `formed in ${percent(value)} of frames` },
    ];
  };

export { bondsPerBlock, buildHbondsModel, describeBond, hbondsTooltip, topBonds };
