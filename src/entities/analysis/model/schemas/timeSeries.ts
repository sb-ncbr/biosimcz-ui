import { z } from "zod";
import type { SeriesStats } from "../types";
import { numberArray, numberTable, statisticalData } from "./primitives";

const computeStats = (values: readonly number[]): SeriesStats => {
  const count = values.length;
  if (count === 0) return { mean: NaN, std: NaN, min: NaN, max: NaN, count: 0 };
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < count; i++) {
    const value = values[i]!;
    sum += value;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  const mean = sum / count;
  let squares = 0;
  for (let i = 0; i < count; i++) squares += (values[i]! - mean) ** 2;
  return { mean, std: Math.sqrt(squares / count), min, max, count };
};

type StatSeries = { key: string; stats: SeriesStats; data: number[] };
type StatSeriesData = { start: number; step: number; series: StatSeries[] };

// Backend-supplied summary values win; they are recomputed from the samples only when absent.
const toStatSeries = (key: string, entry: z.output<typeof statisticalData>): StatSeries => {
  const computed = computeStats(entry.data);
  const stats: SeriesStats = {
    mean: entry.average ?? computed.mean,
    std: entry.stddev ?? computed.std,
    min: entry.min ?? computed.min,
    max: entry.max ?? computed.max,
    count: computed.count,
  };
  return { key, stats, data: entry.data };
};

const statSeriesSchemaFor = (requiredKeys: readonly string[]): z.ZodType<StatSeriesData> =>
  z
    .object({
      start: z.number().optional(),
      step: z.number().optional(),
      y: z.record(z.string(), statisticalData),
    })
    .superRefine((value, ctx) => {
      if (requiredKeys.length === 0 && Object.keys(value.y).length === 0) {
        ctx.addIssue({ code: "custom", message: "No series", path: ["y"] });
      }
      for (const key of requiredKeys) {
        if (!(key in value.y)) ctx.addIssue({ code: "custom", message: `Missing series "${key}"`, path: ["y", key] });
      }
    })
    .transform((value) => ({
      start: value.start ?? 0,
      step: value.step ?? 1,
      series: Object.entries(value.y).map(([key, entry]) => toStatSeries(key, entry)),
    }));

const rmsdSchema = statSeriesSchemaFor(["rmsd"]);
const rgyrSchema = statSeriesSchemaFor(["rgyr", "rgyrx", "rgyry", "rgyrz"]);
const fluctuationSchema = statSeriesSchemaFor(["rmsf"]);

type ReferenceGroupsData = {
  start: number;
  step: number;
  references: string[];
  data: { reference: string; group: string; values: number[] }[];
};

const referenceGroupsSchema: z.ZodType<ReferenceGroupsData> = z
  .object({
    start: z.number().optional(),
    step: z.number().optional(),
    data: z.array(z.object({ reference: z.string(), group: z.string(), values: numberArray })),
  })
  .transform((value) => ({
    start: value.start ?? 0,
    step: value.step ?? 1,
    references: [...new Set(value.data.map((entry) => entry.reference))],
    data: value.data,
  }));

type RmsdPerResidueData = { step: number; residues: { name: string; values: number[] }[] };

// Two wire shapes: named series, or a bare matrix with one row per residue.
const rmsdPerResidueSchema: z.ZodType<RmsdPerResidueData> = z
  .object({
    step: z.number().optional(),
    data: z.array(z.object({ name: z.string(), rmsds: numberArray })).optional(),
    rmsdpr: numberTable.optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.data && !value.rmsdpr) {
      ctx.addIssue({ code: "custom", message: 'Expected "data" or "rmsdpr"', path: ["data"] });
    }
  })
  .transform((value) => ({
    step: value.step ?? 1,
    residues: value.data
      ? value.data.map((entry) => ({ name: entry.name, values: entry.rmsds }))
      : (value.rmsdpr ?? []).map((row, index) => ({ name: `Residue ${index + 1}`, values: row })),
  }));

export {
  fluctuationSchema,
  referenceGroupsSchema,
  rgyrSchema,
  rmsdPerResidueSchema,
  rmsdSchema,
};
export type { ReferenceGroupsData, RmsdPerResidueData, StatSeriesData };
