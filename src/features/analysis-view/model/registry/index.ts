import { baseOf, isAnalysisBase } from "@/entities/analysis";
import { MATRICES_RENDERERS } from "./matrices";
import { MEMBRANE_RENDERERS } from "./membrane";
import { STRUCTURAL_RENDERERS } from "./structural";
import { TIME_SERIES_RENDERERS } from "./timeSeries";
import type { RendererEntry, ResolvedRenderer } from "./types";

const RENDERERS: readonly RendererEntry<unknown>[] = [
  ...TIME_SERIES_RENDERERS,
  ...STRUCTURAL_RENDERERS,
  ...MATRICES_RENDERERS,
  ...MEMBRANE_RENDERERS,
];

// Exact match on the base: "rmsd-pairwise-interface" must not fall into the "rmsd-pairwise" row.
const resolveRenderer = (analysisName: string): ResolvedRenderer => {
  const base = baseOf(analysisName);
  if (!isAnalysisBase(base)) return null;
  const entry = RENDERERS.find((candidate) => candidate.bases.includes(base));
  return entry ? { entry, base } : null;
};

export { resolveRenderer };
export type { PanelContext, PanelProps, RendererEntry, ResolvedRenderer } from "./types";
