import { z } from "zod";
import {
  booleanMatrix,
  fallbackName,
  isObject,
  nullableNumberMatrix,
  numberArray,
  numberMatrix,
  numberTable,
  wrapAsData,
} from "./primitives";

type PairwiseData = { start: number; step: number; matrices: { name: string; values: number[][] }[] };

// Three wire shapes: full, without start/step, and a single legacy { name, rmsds }.
const normalizePairwise = (raw: unknown): unknown => {
  if (!isObject(raw) || !Array.isArray(raw.rmsds)) return raw;
  return { start: raw.start, step: raw.step, data: [{ name: raw.name ?? "Overall", rmsds: raw.rmsds }] };
};

const pairwiseSchema: z.ZodType<PairwiseData> = z
  .preprocess(
    normalizePairwise,
    z.object({
      start: z.number().optional(),
      step: z.number().optional(),
      data: z.array(z.object({ name: z.string(), rmsds: numberMatrix })),
    }),
  )
  .transform((value) => ({
    start: value.start ?? 0,
    step: value.step ?? 1,
    matrices: value.data.map((entry) => ({ name: entry.name, values: entry.rmsds })),
  }));

type DistPerResData = { data: { name: string; means: number[][] | null; stdvs: number[][] | null }[] };

// The old code turned non-finite values into 0, which draws as a real distance; they stay NaN here.
const toNaNMatrix = (matrix: (number | null)[][] | undefined): number[][] | null =>
  matrix ? matrix.map((row) => row.map((value) => value ?? NaN)) : null;

const distPerResSchema: z.ZodType<DistPerResData> = z
  .preprocess(
    wrapAsData(["means", "stdvs"]),
    z.object({
      data: z.array(
        z
          .object({
            name: z.string().optional(),
            means: nullableNumberMatrix.optional(),
            stdvs: nullableNumberMatrix.optional(),
          })
          .refine((entry) => entry.means || entry.stdvs, { message: 'Expected "means" or "stdvs"', path: ["means"] }),
      ),
    }),
  )
  .transform((value) => ({
    data: value.data.map((entry, index) => ({
      name: fallbackName(entry.name, index),
      means: toNaNMatrix(entry.means),
      stdvs: toNaNMatrix(entry.stdvs),
    })),
  }));

type HbondsData = {
  interactions: {
    name: string;
    donors: number[];
    acceptors: number[];
    hydrogens: number[];
    // Fraction of the simulation each bond is formed, one value per bond.
    occupancy: number[];
    // One row per bond. Live data holds fractions per time block; the old type declared per-frame booleans.
    timed: Float64Array[];
  }[];
};

const toRows = (matrix: number[][] | (boolean | 0 | 1)[][] | undefined): Float64Array[] =>
  (matrix ?? []).map((row) => Float64Array.from(row as ArrayLike<number | boolean>, Number));

const rowMean = (row: Float64Array): number => {
  let sum = 0;
  for (let i = 0; i < row.length; i++) sum += row[i]!;
  return row.length > 0 ? sum / row.length : NaN;
};

const matrixOrFlags = z.union([numberTable, booleanMatrix]);

const hbondsSchema: z.ZodType<HbondsData> = z
  .preprocess(
    wrapAsData(["hbonds", "hbonds_timed", "donors", "acceptors"]),
    z.object({
      data: z.array(
        z
          .object({
            name: z.string().optional(),
            donors: numberArray.default([]),
            acceptors: numberArray.default([]),
            hydrogens: numberArray.default([]),
            hbonds: z.union([numberArray, booleanMatrix]).optional(),
            hbonds_timed: matrixOrFlags.optional(),
          })
          .refine((entry) => entry.hbonds || entry.hbonds_timed, {
            message: 'Expected "hbonds" or "hbonds_timed"',
            path: ["hbonds"],
          }),
      ),
    }),
  )
  .transform((value) => ({
    interactions: value.data.map((entry, index) => {
      const timedSource = entry.hbonds_timed ?? (entry.hbonds && Array.isArray(entry.hbonds[0]) ? entry.hbonds : undefined);
      const timed = toRows(timedSource as number[][] | undefined);
      const fractions = entry.hbonds && !Array.isArray(entry.hbonds[0]) ? (entry.hbonds as number[]) : null;
      return {
        name: fallbackName(entry.name, index),
        donors: entry.donors,
        acceptors: entry.acceptors,
        hydrogens: entry.hydrogens,
        occupancy: fractions ?? timed.map(rowMean),
        timed,
      };
    }),
  }));

// Stricter than the old guard, which accepted any object with a name.
const interactionSchema = z.object({
  name: z.string(),
  agent_1: z.string(),
  agent_2: z.string(),
  has_cg: z.boolean().optional(),
  version: z.string().optional(),
  strong_bonds: numberTable.optional(),
  atom_indices_1: numberArray.optional(),
  atom_indices_2: numberArray.optional(),
  interface_atom_indices_1: numberArray.optional(),
  interface_atom_indices_2: numberArray.optional(),
  residue_indices_1: numberArray.optional(),
  residue_indices_2: numberArray.optional(),
  interface_indices_1: numberArray.optional(),
  interface_indices_2: numberArray.optional(),
});

type InteractionData = z.output<typeof interactionSchema>;

const interactionsSchema: z.ZodType<InteractionData[]> = z.preprocess(
  (raw) => (Array.isArray(raw) ? raw : [raw]),
  z.array(interactionSchema),
);

export { distPerResSchema, hbondsSchema, interactionsSchema, pairwiseSchema };
export type { DistPerResData, HbondsData, InteractionData, PairwiseData };
