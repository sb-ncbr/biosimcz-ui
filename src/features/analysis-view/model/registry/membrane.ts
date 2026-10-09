import { lazy } from "react";
import {
  aplSchema,
  densitySchema,
  lipidInterSchema,
  lipidOrderSchema,
  memMapSchema,
  parseWith,
  thicknessSchema,
  type AplData,
  type DensityData,
  type LipidInterData,
  type LipidOrderData,
  type MemMapData,
  type ThicknessData,
} from "@/entities/analysis";
import { defineRenderer } from "./defineRenderer";
import type { RendererEntry } from "./types";

const MEMBRANE_RENDERERS: readonly RendererEntry<unknown>[] = [
  defineRenderer<AplData>({
    bases: ["apl"],
    parse: (raw) => parseWith(aplSchema, raw),
    Panel: lazy(() => import("../../panels/AplPanel/View")),
  }),
  defineRenderer<MemMapData>({
    bases: ["mem-map"],
    parse: (raw) => parseWith(memMapSchema, raw),
    Panel: lazy(() => import("../../panels/MemMapPanel/View")),
  }),
  defineRenderer<LipidInterData>({
    bases: ["lipid-inter"],
    parse: (raw) => parseWith(lipidInterSchema, raw),
    Panel: lazy(() => import("../../panels/LipidInterPanel/View")),
  }),
  defineRenderer<ThicknessData>({
    bases: ["thickness"],
    parse: (raw) => parseWith(thicknessSchema, raw),
    Panel: lazy(() => import("../../panels/ThicknessPanel/View")),
  }),
  defineRenderer<DensityData>({
    bases: ["density"],
    parse: (raw) => parseWith(densitySchema, raw),
    Panel: lazy(() => import("../../panels/DensityPanel/View")),
  }),
  defineRenderer<LipidOrderData>({
    bases: ["lipid-order"],
    parse: (raw) => parseWith(lipidOrderSchema, raw),
    Panel: lazy(() => import("../../panels/LipidOrderPanel/View")),
  }),
];

export { MEMBRANE_RENDERERS };
