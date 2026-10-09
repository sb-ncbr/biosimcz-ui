import { lazy } from "react";
import {
  clustersSchema,
  energiesSchema,
  parseWith,
  pcaSchema,
  pocketsSchema,
  sasaSchema,
  type ClustersData,
  type EnergiesData,
  type PcaData,
  type PocketsData,
  type SasaData,
} from "@/entities/analysis";
import { defineRenderer } from "./defineRenderer";
import type { RendererEntry } from "./types";

// Filled by its stage-6 batch; kept as its own file so batches never touch the same one.
const STRUCTURAL_RENDERERS: readonly RendererEntry<unknown>[] = [
  defineRenderer<PcaData>({
    bases: ["pca"],
    parse: (raw) => parseWith(pcaSchema, raw),
    Panel: lazy(() => import("../../panels/PcaPanel/View")),
  }),
  defineRenderer<PocketsData>({
    bases: ["pockets"],
    parse: (raw) => parseWith(pocketsSchema, raw),
    Panel: lazy(() => import("../../panels/PocketsPanel/View")),
  }),
  defineRenderer<SasaData>({
    bases: ["sasa"],
    parse: (raw) => parseWith(sasaSchema, raw),
    Panel: lazy(() => import("../../panels/SasaPanel/View")),
  }),
  defineRenderer<ClustersData>({
    bases: ["clusters"],
    parse: (raw) => parseWith(clustersSchema, raw),
    Panel: lazy(() => import("../../panels/ClustersPanel/View")),
  }),
  defineRenderer<EnergiesData>({
    bases: ["energies"],
    parse: (raw) => parseWith(energiesSchema, raw),
    Panel: lazy(() => import("../../panels/EnergiesPanel/View")),
  }),
];

export { STRUCTURAL_RENDERERS };
