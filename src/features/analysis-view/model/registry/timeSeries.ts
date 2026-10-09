import { lazy } from "react";
import {
  fluctuationSchema,
  parseWith,
  referenceGroupsSchema,
  rgyrSchema,
  rmsdPerResidueSchema,
  rmsdSchema,
} from "@/entities/analysis";
import { defineRenderer } from "./defineRenderer";
import type { RendererEntry } from "./types";

const StatSeriesPanel = lazy(() => import("../../panels/StatSeriesPanel/View"));
const ReferenceGroupsPanel = lazy(() => import("../../panels/ReferenceGroupsPanel/View"));
const RmsdPerResiduePanel = lazy(() => import("../../panels/RmsdPerResiduePanel/View"));

const TIME_SERIES_RENDERERS: readonly RendererEntry<unknown>[] = [
  defineRenderer({
    bases: ["rmsd"],
    parse: (raw) => parseWith(rmsdSchema, raw),
    Panel: StatSeriesPanel,
    config: { title: "RMSD", quantity: "RMSD", xLabel: "Frame", seriesNames: { rmsd: "RMSD" } },
  }),
  defineRenderer({
    bases: ["rgyr"],
    parse: (raw) => parseWith(rgyrSchema, raw),
    Panel: StatSeriesPanel,
    config: {
      title: "Radius of gyration",
      quantity: "Rg",
      xLabel: "Frame",
      seriesNames: { rgyr: "Rg", rgyrx: "Rg X", rgyry: "Rg Y", rgyrz: "Rg Z" },
    },
  }),
  defineRenderer({
    bases: ["fluctuation"],
    parse: (raw) => parseWith(fluctuationSchema, raw),
    Panel: StatSeriesPanel,
    // Live payloads carry no start/step and one value per atom, so the x axis is an atom index.
    config: { title: "Fluctuation", quantity: "RMSF", xLabel: "Atom index", indexAxis: true, seriesNames: { rmsf: "RMSF" } },
  }),
  defineRenderer({
    bases: ["rmsds"],
    parse: (raw) => parseWith(referenceGroupsSchema, raw),
    Panel: ReferenceGroupsPanel,
    config: { title: "RMSD by reference", quantity: "RMSD" },
  }),
  defineRenderer({
    bases: ["tmscores"],
    parse: (raw) => parseWith(referenceGroupsSchema, raw),
    Panel: ReferenceGroupsPanel,
    config: { title: "TM-score", quantity: "TM-score", yRange: { min: 0, max: 1 } },
  }),
  defineRenderer({
    bases: ["rmsd-perres"],
    parse: (raw) => parseWith(rmsdPerResidueSchema, raw),
    Panel: RmsdPerResiduePanel,
  }),
];

export { TIME_SERIES_RENDERERS };
