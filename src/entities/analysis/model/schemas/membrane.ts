import { z } from "zod";
import { numberArray, numberMatrix } from "./primitives";

type AplData = {
  upper: number[][];
  lower: number[][];
  gridX: number[];
  gridY: number[];
  median: number[];
  std: number[];
};

// The old type declares a number, the live data was read as arrays: both are accepted.
const scalarOrArray = z.union([z.number(), numberArray]).transform((value) => (typeof value === "number" ? [value] : value));

const aplSchema: z.ZodType<AplData> = z
  .object({
    data: z.object({
      "upper leaflet": numberMatrix.optional(),
      "lower leaflet": numberMatrix.optional(),
      grid_x: numberArray.optional(),
      grid_y: numberArray.optional(),
      median: scalarOrArray,
      std: scalarOrArray,
    }),
  })
  .refine((value) => value.data["upper leaflet"] || value.data["lower leaflet"], {
    message: "Expected at least one leaflet",
    path: ["data"],
  })
  .transform(({ data }) => ({
    upper: data["upper leaflet"] ?? [],
    lower: data["lower leaflet"] ?? [],
    gridX: data.grid_x ?? [],
    gridY: data.grid_y ?? [],
    median: data.median,
    std: data.std,
  }));

const leafletPair = z.object({ top: numberArray, bot: numberArray });

type MemMapData = {
  n_mems: number | null;
  ids: string[];
  mems: Record<string, { leaflets: { top: number[]; bot: number[] }; polar_atoms: { top: number[]; bot: number[] } }>;
  no_mem_lipid: number[];
};

const memMapSchema: z.ZodType<MemMapData> = z
  .object({
    n_mems: z.number().optional(),
    mems: z.record(z.string(), z.object({ leaflets: leafletPair, polar_atoms: leafletPair })).default({}),
    no_mem_lipid: numberArray.default([]),
  })
  .refine((value) => Object.keys(value.mems).length > 0 || value.no_mem_lipid.length > 0, {
    message: "Expected membranes or unassigned lipids",
    path: ["mems"],
  })
  .transform((value) => ({
    n_mems: value.n_mems ?? null,
    ids: Object.keys(value.mems).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    mems: value.mems,
    no_mem_lipid: value.no_mem_lipid,
  }));

type LipidInterData = { residues: number[]; lipids: { key: string; values: number[] }[] };

const fitTo = (values: number[], length: number): number[] =>
  values.length >= length ? values.slice(0, length) : [...values, ...new Array<number>(length - values.length).fill(NaN)];

const lipidInterSchema: z.ZodType<LipidInterData> = z
  .object({ data: z.object({ residue_indices: numberArray }).catchall(numberArray) })
  .refine((value) => Object.keys(value.data).length > 1, { message: "Expected at least one lipid", path: ["data"] })
  .transform(({ data }) => {
    const { residue_indices: residues, ...lipids } = data;
    return {
      residues,
      lipids: Object.entries(lipids).map(([key, values]) => ({ key, values: fitTo(values, residues.length) })),
    };
  });

type ThicknessData = {
  step: number;
  frame: number[];
  thickness: number[];
  mean_positive?: number[];
  mean_negative?: number[];
  std_positive?: number[];
  std_negative?: number[];
  std_thickness?: number[];
  midplane_z?: number[];
};

const thicknessSchema: z.ZodType<ThicknessData> = z
  .object({
    step: z.number().optional(),
    data: z.object({
      frame: numberArray.optional(),
      mean_positive: numberArray.optional(),
      mean_negative: numberArray.optional(),
      std_positive: numberArray.optional(),
      std_negative: numberArray.optional(),
      thickness: numberArray,
      std_thickness: numberArray.optional(),
      midplane_z: numberArray.optional(),
    }),
  })
  .transform(({ step, data }) => ({
    ...data,
    step: step ?? 1,
    frame: data.frame ?? data.thickness.map((_, index) => index),
  }));

const densityMetric = z.object({ dens: numberArray, stdv: numberArray.optional() });

type DensityMetric = z.output<typeof densityMetric>;
type DensityData = {
  z: number[];
  comps: {
    name: string;
    selection?: string | number[];
    number?: DensityMetric;
    mass?: DensityMetric;
    charge?: DensityMetric;
    electron?: DensityMetric;
  }[];
};

const densitySchema: z.ZodType<DensityData> = z
  .object({
    data: z.object({
      z: numberArray,
      comps: z.array(
        z
          .object({
            name: z.string(),
            selection: z.union([z.string(), numberArray]).optional(),
            number: densityMetric.optional(),
            mass: densityMetric.optional(),
            charge: densityMetric.optional(),
            electron: densityMetric.optional(),
          })
          .refine((comp) => comp.number || comp.mass || comp.charge || comp.electron, {
            message: "Expected at least one density metric",
            path: ["number"],
          }),
      ),
    }),
  })
  .transform(({ data }) => data);

type LipidOrderSegment = { atoms: string[]; avg: number[]; std: number[] };
type LipidOrderData = { data: Record<string, Record<string, LipidOrderSegment>> };

const lipidOrderSchema: z.ZodType<LipidOrderData> = z
  .object({
    data: z.record(
      z.string(),
      z.record(
        z.string(),
        z.object({
          atoms: z.array(z.string()).default([]),
          avg: numberArray,
          std: numberArray.default([]),
        }),
      ),
    ),
  })
  .refine((value) => Object.keys(value.data).length > 0, { message: "Expected at least one lipid", path: ["data"] });

export { aplSchema, densitySchema, lipidInterSchema, lipidOrderSchema, memMapSchema, thicknessSchema };
export type {
  AplData,
  DensityData,
  LipidInterData,
  LipidOrderData,
  LipidOrderSegment,
  MemMapData,
  ThicknessData,
};
