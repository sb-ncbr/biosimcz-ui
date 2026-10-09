import type { InteractionData } from "@/entities/analysis";
import { binMatrix, type BinnedMatrix, type HeatmapScale, type TooltipRow } from "@/shared/viewers/echarts";
import type { PanelSelectOption } from "../PanelSelect";
import { formatValue } from "../timeSeriesCommon";

type Level = "residue" | "atom";

const INTERACTION_TARGET = 256;
const SNAPSHOT_LIMIT = 15;
// Above this the raw class matrix would cost more memory than it is worth drawing.
const MAX_CELLS = 4_000_000;

const interactionOptions = (data: readonly InteractionData[]): PanelSelectOption[] =>
  data.map((entry, index) => ({ value: String(index), label: entry.name || `Interaction ${index + 1}` }));

// Fixes the old "indexs": the noun comes from the level, never from a label with an added "s".
const countText = (count: number, level: Level): string => `${count} ${level}${count === 1 ? "" : "s"}`;

type Side = { agent: string; items: readonly number[]; interfaceItems: readonly number[] };

const sidesOf = (entry: InteractionData): { level: Level; first: Side; second: Side } | null => {
  const residues1 = entry.residue_indices_1 ?? [];
  const residues2 = entry.residue_indices_2 ?? [];
  if (residues1.length > 0 && residues2.length > 0) {
    return {
      level: "residue",
      first: { agent: entry.agent_1, items: residues1, interfaceItems: entry.interface_indices_1 ?? [] },
      second: { agent: entry.agent_2, items: residues2, interfaceItems: entry.interface_indices_2 ?? [] },
    };
  }
  const atoms1 = entry.atom_indices_1 ?? [];
  const atoms2 = entry.atom_indices_2 ?? [];
  if (atoms1.length > 0 && atoms2.length > 0) {
    return {
      level: "atom",
      first: { agent: entry.agent_1, items: atoms1, interfaceItems: entry.interface_atom_indices_1 ?? [] },
      second: { agent: entry.agent_2, items: atoms2, interfaceItems: entry.interface_atom_indices_2 ?? [] },
    };
  }
  return null;
};

// Class 0 neither, 1 agent 2 interface, 2 agent 1 interface, 3 both. Rows are agent 2, columns agent 1.
const classMatrix = (first: Side, second: Side): Uint8Array[] => {
  const interface1 = new Set(first.interfaceItems);
  const interface2 = new Set(second.interfaceItems);
  const colClass = Uint8Array.from(first.items, (item) => (interface1.has(item) ? 2 : 0));
  const rows: Uint8Array[] = [];
  for (let r = 0; r < second.items.length; r++) {
    const rowClass = interface2.has(second.items[r]!) ? 1 : 0;
    const row = new Uint8Array(colClass.length);
    for (let c = 0; c < colClass.length; c++) row[c] = colClass[c]! + rowClass;
    rows.push(row);
  }
  return rows;
};

const idRange = (items: readonly number[], [from, to]: readonly [number, number]): string =>
  from === to ? String(items[from]) : `${items[from]}-${items[to]}`;

type SideInfo = { agent: string; total: number; interfaceCount: number; sample: number[]; hidden: number };

const sideInfo = (side: Side): SideInfo => ({
  agent: side.agent,
  total: side.items.length,
  interfaceCount: side.interfaceItems.length,
  sample: side.interfaceItems.slice(0, SNAPSHOT_LIMIT),
  hidden: Math.max(0, side.interfaceItems.length - SNAPSHOT_LIMIT),
});

type InteractionsModel = {
  options: PanelSelectOption[];
  selectedId: string;
  name: string | null;
  level: Level | null;
  sides: [SideInfo, SideInfo] | null;
  matrix: BinnedMatrix | null;
  scale: HeatmapScale;
  categorical: boolean;
  note: string;
  rowLabels: string[];
  colLabels: string[];
  classLabel: (value: number) => string;
  summary: string;
  emptyReason: string | null;
};

const CONTINUOUS: HeatmapScale = { kind: "continuous", min: 0, max: 3, filter: false };

const buildInteractionsModel = (data: readonly InteractionData[], chosen: string | null): InteractionsModel => {
  const options = interactionOptions(data);
  const selectedId = chosen !== null && data[Number(chosen)] ? chosen : data.length > 0 ? "0" : "";
  const entry = data[Number(selectedId)];
  const base = {
    options,
    selectedId,
    name: entry?.name ?? null,
    level: null,
    sides: null,
    matrix: null,
    scale: CONTINUOUS,
    categorical: false,
    note: "",
    rowLabels: [],
    colLabels: [],
    classLabel: () => "",
  };
  const unavailable = (reason: string): InteractionsModel => ({ ...base, summary: reason, emptyReason: reason });

  if (!entry) return unavailable("No interaction data in this analysis");
  const sides = sidesOf(entry);
  if (!sides) {
    return unavailable("Residue or atom lists were not provided for this interaction, so the interface map is unavailable");
  }
  const { level, first, second } = sides;
  const info: [SideInfo, SideInfo] = [sideInfo(first), sideInfo(second)];
  if (first.items.length * second.items.length > MAX_CELLS) {
    return { ...base, level, sides: info, summary: `${entry.name}: too large to draw`, emptyReason: `This interaction has ${countText(first.items.length, level)} by ${countText(second.items.length, level)}, too many to draw` };
  }

  const matrix = binMatrix(classMatrix(first, second), INTERACTION_TARGET);
  const categorical = matrix.rowStride === 1 && matrix.colStride === 1;
  const labels: [string, string] = [`${second.agent} interface`, `${first.agent} interface`];
  const classNames = ["Neither", labels[0], labels[1], "Both"];
  const classes = classNames.map((label, value) => ({ value, label }));
  const scale: HeatmapScale = categorical ? { kind: "categorical", classes } : CONTINUOUS;
  const note = categorical
    ? `Each cell is one ${level} pair, coloured by which agents have it in their interface.`
    : `Too many ${level}s to draw one cell each: every cell averages up to ${matrix.rowStride} x ${matrix.colStride} pairs, so its colour is the mean class (0 neither, 1 ${labels[0]}, 2 ${labels[1]}, 3 both), not a single class.`;

  return {
    ...base,
    level,
    sides: info,
    matrix,
    scale,
    categorical,
    note,
    rowLabels: matrix.rowRanges.map((range) => idRange(second.items, range)),
    colLabels: matrix.colRanges.map((range) => idRange(first.items, range)),
    classLabel: (value) => classNames[Math.round(value)] ?? formatValue(value, 2),
    summary: `${entry.name}: ${first.agent} ${countText(info[0].total, level)} (${info[0].interfaceCount} in the interface) against ${second.agent} ${countText(info[1].total, level)} (${info[1].interfaceCount} in the interface).`,
    emptyReason: null,
  };
};

const interactionsTooltip =
  (model: InteractionsModel) =>
  ({ row, col, value }: { row: number; col: number; value: number }): TooltipRow[] => {
    const [first, second] = model.sides ?? [null, null];
    const unit = model.level ?? "item";
    return [
      { label: `${second?.agent ?? "Agent 2"} ${unit}`, value: model.rowLabels[row] ?? String(row) },
      { label: `${first?.agent ?? "Agent 1"} ${unit}`, value: model.colLabels[col] ?? String(col) },
      model.categorical
        ? { label: "Class", value: model.classLabel(value) }
        : { label: "Mean class", value: `${formatValue(value, 2)} (nearest: ${model.classLabel(value)})` },
    ];
  };

export { SNAPSHOT_LIMIT, buildInteractionsModel, classMatrix, countText, interactionsTooltip, sidesOf };
export type { Level, SideInfo };
