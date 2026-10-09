import type { AnalysisBase } from "./names";
import type { AxisKey, UnitLabel } from "./types";

const unconfirmed = (text: string): UnitLabel => ({ text, confirmed: false });

// Only units the old UI printed on its axes. Everything else is absent on purpose: no guessing (OQ6).
const ANALYSIS_UNITS: Record<AnalysisBase, Partial<Record<AxisKey, UnitLabel>>> = {
  rmsd: { y: unconfirmed("nm") },
  rmsds: { y: unconfirmed("nm") },
  rgyr: { y: unconfirmed("nm") },
  fluctuation: { y: unconfirmed("nm") },
  "rmsd-perres": { y: unconfirmed("nm") },
  "rmsd-pairwise": {},
  "rmsd-pairwise-interface": {},
  "dist-perres": {},
  "dist-perres-mean": {},
  "dist-perres-stdv": {},
  energies: { y: unconfirmed("kcal/mol") },
  hbonds: {},
  interactions: {},
  pca: {},
  pockets: { y: unconfirmed("A^3") },
  sasa: {},
  tmscores: {},
  clusters: {},
  "mem-map": {},
  apl: { y: unconfirmed("Å^2"), value: unconfirmed("Å^2") },
  density: { x: unconfirmed("Å") },
  "lipid-inter": {},
  "lipid-order": {},
  thickness: { y: unconfirmed("Å") },
};

export { ANALYSIS_UNITS };
