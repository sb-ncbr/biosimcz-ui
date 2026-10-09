import { z } from "zod";
import {
  fallbackName,
  isObject,
  nullableNumberArray,
  nullableNumberTable,
  numberArray,
  numberTable,
  wrapAsData,
} from "./primitives";

type PcaData = { eigenvalues: number[]; projections: number[][]; components: number };

const pcaCore = z.object({
  framestep: z.number().optional(),
  atoms: numberArray.optional(),
  eigenvalues: numberArray,
  projections: numberTable,
});

// Older payloads nest the same object under "data".
const pcaSchema: z.ZodType<PcaData> = z
  .preprocess((raw) => (isObject(raw) && !("eigenvalues" in raw) && isObject(raw.data) ? raw.data : raw), pcaCore)
  .transform((value) => ({
    eigenvalues: value.eigenvalues,
    projections: value.projections,
    // Real payloads are [component][frame] (14 x 1926); eigenvalues cover a longer spectrum, so they do not count components.
    components: value.projections.length,
  }))
  .refine((value) => value.components >= 2, {
    message: "PCA needs projections with at least two components",
    path: ["projections"],
  });

type PocketsData = { start: number; step: number; data: { name: string; volumes: number[]; atoms: number[] }[] };

const pocketsSchema: z.ZodType<PocketsData> = z
  .object({
    start: z.number().optional(),
    step: z.number().optional(),
    data: z.array(z.object({ name: z.string(), volumes: nullableNumberArray, atoms: numberArray })),
  })
  .transform((value) => ({
    start: value.start ?? 0,
    step: value.step ?? 1,
    data: value.data.map((entry) => ({
      name: entry.name,
      volumes: entry.volumes.map((volume) => volume ?? NaN),
      atoms: entry.atoms,
    })),
  }));

type SasaData = { step: number; perResidue: Float64Array[]; total: Float64Array };

// saspf is [residue][frame]; null marks a missing sample and stays out of the per-frame total.
const sasaSchema: z.ZodType<SasaData> = z
  .object({
    step: z.number().optional(),
    saspf: nullableNumberTable,
    means: numberArray.optional(),
    stdvs: numberArray.optional(),
  })
  .transform((value) => {
    let frames = 0;
    for (const row of value.saspf) if (row.length > frames) frames = row.length;
    const total = new Float64Array(frames);
    const perResidue = value.saspf.map((row) => {
      const values = new Float64Array(row.length);
      for (let frame = 0; frame < row.length; frame++) {
        const sample = row[frame] ?? null;
        values[frame] = sample ?? NaN;
        if (sample !== null) total[frame] = total[frame]! + sample;
      }
      return values;
    });
    return { step: value.step ?? 1, perResidue, total };
  });

type ClustersData = {
  name: string;
  cutoff: number;
  clusters: { frames: number[]; main: number }[];
  transitions: { from: number; to: number; count: number }[];
  step: number;
  version: string | null;
};

// from/to index semantics (cluster position or id) are UNKNOWN upstream; panels resolve them as the old UI did.
const clustersSchema: z.ZodType<ClustersData> = z
  .object({
    name: z.string(),
    cutoff: z.number(),
    clusters: z.array(z.object({ frames: numberArray, main: z.number() })),
    transitions: z.array(z.object({ from: z.number(), to: z.number(), count: z.number() })).default([]),
    step: z.number(),
    version: z.string().optional(),
  })
  .transform((value) => ({ ...value, version: value.version ?? null }));

const ENERGY_STAGES = ["overall", "initial", "final"] as const;
type EnergyStage = (typeof ENERGY_STAGES)[number];
type EnergySeries = { es: number[]; vdw: number[]; both: number[] };
type EnergyAgent = { labels: string[]; stages: Record<EnergyStage, EnergySeries> };
type EnergiesData = { data: { name: string; agent1: EnergyAgent; agent2: EnergyAgent }[] };

const optionalNumbers = numberArray.optional().transform((value) => value ?? []);

const energyAgentSchema = z.object({
  labels: z.array(z.string()).optional(),
  es: optionalNumbers,
  ies: optionalNumbers,
  fes: optionalNumbers,
  vdw: optionalNumbers,
  ivdw: optionalNumbers,
  fvdw: optionalNumbers,
  both: optionalNumbers,
  iboth: optionalNumbers,
  fboth: optionalNumbers,
});

// Arrays of one agent can differ in length; every series is cut to the shortest non-empty one.
const toEnergyAgent = (agent: z.output<typeof energyAgentSchema>): EnergyAgent => {
  const labels = (agent.labels ?? []).map((label) => label.trim());
  const arrays = [labels, agent.es, agent.ies, agent.fes, agent.vdw, agent.ivdw, agent.fvdw, agent.both, agent.iboth, agent.fboth];
  let common = Infinity;
  for (const values of arrays) if (values.length > 0 && values.length < common) common = values.length;
  if (common === Infinity) common = 0;
  const trim = (values: number[]): number[] => values.slice(0, common);
  return {
    labels: labels.slice(0, common),
    stages: {
      overall: { es: trim(agent.es), vdw: trim(agent.vdw), both: trim(agent.both) },
      initial: { es: trim(agent.ies), vdw: trim(agent.ivdw), both: trim(agent.iboth) },
      final: { es: trim(agent.fes), vdw: trim(agent.fvdw), both: trim(agent.fboth) },
    },
  };
};

const energiesSchema: z.ZodType<EnergiesData> = z
  .preprocess(
    wrapAsData(["agent1", "agent2"]),
    z.object({
      data: z.array(z.object({ name: z.string().optional(), agent1: energyAgentSchema, agent2: energyAgentSchema })),
    }),
  )
  .transform((value) => ({
    data: value.data.map((entry, index) => ({
      name: fallbackName(entry.name, index),
      agent1: toEnergyAgent(entry.agent1),
      agent2: toEnergyAgent(entry.agent2),
    })),
  }));

export { ENERGY_STAGES, clustersSchema, energiesSchema, pcaSchema, pocketsSchema, sasaSchema };
export type { ClustersData, EnergiesData, EnergyAgent, EnergySeries, EnergyStage, PcaData, PocketsData, SasaData };
