import type { PcaData } from "@/entities/analysis";
import { effectiveChoice, formatValue } from "../structuralCommon";

type PcaModel = {
  components: number;
  // Fraction of the summed eigenvalues for each shown component.
  variance: number[];
  eigenvalues: number[];
  options: { value: string; label: string }[];
  frames: number;
};

const sumFinite = (values: readonly number[]): number => {
  let total = 0;
  for (let i = 0; i < values.length; i++) if (Number.isFinite(values[i]!)) total += values[i]!;
  return total;
};

const buildPcaModel = (data: PcaData): PcaModel => {
  const shown = Math.min(data.components, data.eigenvalues.length);
  const total = sumFinite(data.eigenvalues);
  const eigenvalues = data.eigenvalues.slice(0, shown);
  const variance = eigenvalues.map((value) => (total > 0 ? value / total : NaN));
  const options = Array.from({ length: data.components }, (_, i) => ({
    value: String(i + 1),
    label: `PC ${i + 1}`,
  }));
  return {
    components: data.components,
    variance,
    eigenvalues,
    options,
    frames: data.projections[0]?.length ?? 0,
  };
};

// Defaults to PC 1 against PC 2; the stored choice is only honoured while it still exists.
const effectiveComponents = (chosen: { x: string | null; y: string | null }, components: number): { x: number; y: number } => {
  const valid = Array.from({ length: components }, (_, i) => String(i + 1));
  return {
    x: Number(effectiveChoice(chosen.x, valid, "1")),
    y: Number(effectiveChoice(chosen.y, valid, valid.length > 1 ? "2" : "1")),
  };
};

type ScatterInput = {
  x: ArrayLike<number>;
  y: ArrayLike<number>;
  color: Float64Array;
};

const scatterInput = (data: PcaData, x: number, y: number): ScatterInput => {
  const xs = data.projections[x - 1] ?? [];
  const ys = data.projections[y - 1] ?? [];
  const count = Math.min(xs.length, ys.length);
  // The frame index doubles as the colour scale, so trajectory order stays visible without a brush.
  const color = new Float64Array(count);
  for (let i = 0; i < count; i++) color[i] = i;
  return { x: xs, y: ys, color };
};

const axisLabel = (component: number, variance: readonly number[]): string => {
  const share = variance[component - 1];
  return share !== undefined && Number.isFinite(share) ? `PC${component} (${formatValue(share * 100, 1)}%)` : `PC${component}`;
};

const scatterCsv = (input: ScatterInput, xHeader: string, yHeader: string): string => {
  const rows = ["frame," + xHeader + "," + yHeader];
  for (let i = 0; i < input.color.length; i++) rows.push(`${i},${input.x[i]},${input.y[i]}`);
  return rows.join("\n");
};

const pcaSummary = (model: PcaModel): string => {
  const top = model.variance[0];
  const lead = top !== undefined && Number.isFinite(top) ? ` PC1 holds ${formatValue(top * 100, 1)}% of the summed eigenvalues.` : "";
  return `${model.components} principal components over ${model.frames} projected frames.${lead}`;
};

export { axisLabel, buildPcaModel, effectiveComponents, pcaSummary, scatterCsv, scatterInput };
