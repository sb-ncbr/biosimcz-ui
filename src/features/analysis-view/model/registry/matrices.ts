import { lazy } from "react";
import { distPerResSchema, hbondsSchema, interactionsSchema, pairwiseSchema, parseWith } from "@/entities/analysis";
import { defineRenderer } from "./defineRenderer";
import type { RendererEntry } from "./types";

const PairwisePanel = lazy(() => import("../../panels/PairwisePanel/View"));
const DistPerResPanel = lazy(() => import("../../panels/DistPerResPanel/View"));
const HbondsPanel = lazy(() => import("../../panels/HbondsPanel/View"));
const InteractionsPanel = lazy(() => import("../../panels/InteractionsPanel/View"));

const MATRICES_RENDERERS: readonly RendererEntry<unknown>[] = [
  defineRenderer({
    bases: ["rmsd-pairwise"],
    parse: (raw) => parseWith(pairwiseSchema, raw),
    Panel: PairwisePanel,
    config: { variant: "global" },
  }),
  defineRenderer({
    bases: ["rmsd-pairwise-interface"],
    parse: (raw) => parseWith(pairwiseSchema, raw),
    Panel: PairwisePanel,
    config: { variant: "interface" },
  }),
  defineRenderer({
    bases: ["dist-perres", "dist-perres-mean", "dist-perres-stdv"],
    parse: (raw) => parseWith(distPerResSchema, raw),
    Panel: DistPerResPanel,
  }),
  defineRenderer({
    bases: ["hbonds"],
    parse: (raw) => parseWith(hbondsSchema, raw),
    Panel: HbondsPanel,
  }),
  defineRenderer({
    bases: ["interactions"],
    parse: (raw) => parseWith(interactionsSchema, raw),
    Panel: InteractionsPanel,
  }),
];

export { MATRICES_RENDERERS };
