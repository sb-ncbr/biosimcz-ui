import type { AnalysisGroup } from "./types";

const ANALYSIS_BASES = [
  "rmsd",
  "rmsds",
  "rgyr",
  "fluctuation",
  "rmsd-perres",
  "rmsd-pairwise",
  "rmsd-pairwise-interface",
  "dist-perres",
  "dist-perres-mean",
  "dist-perres-stdv",
  "energies",
  "hbonds",
  "interactions",
  "pca",
  "pockets",
  "sasa",
  "tmscores",
  "clusters",
  "mem-map",
  "apl",
  "density",
  "lipid-inter",
  "lipid-order",
  "thickness",
] as const;

type AnalysisBase = (typeof ANALYSIS_BASES)[number];

const BASE_LABELS: Record<AnalysisBase, string> = {
  rmsd: "RMSD",
  rmsds: "RMSD (Multiple)",
  rgyr: "Radius of Gyration",
  fluctuation: "RMSF (Fluctuation)",
  "rmsd-perres": "RMSD per Residue",
  "rmsd-pairwise": "RMSD Pairwise",
  "rmsd-pairwise-interface": "RMSD Pairwise (Interface)",
  "dist-perres": "Distance per Residue",
  "dist-perres-mean": "Distance per Residue (Mean)",
  "dist-perres-stdv": "Distance per Residue (Std Dev)",
  energies: "Energies",
  hbonds: "Hydrogen Bonds",
  interactions: "Interactions",
  pca: "PCA",
  pockets: "Pockets",
  sasa: "SASA",
  tmscores: "TM-scores",
  clusters: "Clusters",
  "mem-map": "Membrane Map",
  apl: "Area per Lipid",
  density: "Density Profile",
  "lipid-inter": "Lipid Interactions",
  "lipid-order": "Lipid Order",
  thickness: "Membrane Thickness",
};

const VARIANT_SUFFIX = /^(.*?)-(\d+)$/;
// Names end up in URLs and BFF paths: lowercase slug only.
const SLUG = /^[a-z][a-z0-9-]{0,63}$/;
const BASE_SET: ReadonlySet<string> = new Set(ANALYSIS_BASES);

const baseOf = (name: string): string => VARIANT_SUFFIX.exec(name)?.[1] ?? name;

const isAnalysisBase = (name: string): name is AnalysisBase => BASE_SET.has(name);

const isAnalysisName = (name: string): boolean => SLUG.test(name) && isAnalysisBase(baseOf(name));

const toTitleCase = (id: string): string =>
  id
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(" ");

const baseLabel = (base: string): string => (isAnalysisBase(base) ? BASE_LABELS[base] : toTitleCase(base));

const labelOf = (name: string): string => {
  const match = VARIANT_SUFFIX.exec(name);
  return match ? `${baseLabel(match[1]!)} - ${match[2]}` : baseLabel(name);
};

const groupAnalyses = (names: readonly string[] | null | undefined): AnalysisGroup[] => {
  const groups = new Map<string, AnalysisGroup>();
  for (const name of names ?? []) {
    const baseId = baseOf(name);
    let group = groups.get(baseId);
    if (!group) {
      group = { baseId, label: baseLabel(baseId), variants: [], hasVariants: false };
      groups.set(baseId, group);
    }
    if (!group.variants.includes(name)) group.variants.push(name);
    if (name !== baseId) group.hasVariants = true;
  }
  return [...groups.values()];
};

export { ANALYSIS_BASES, baseOf, groupAnalyses, isAnalysisBase, isAnalysisName, labelOf };
export type { AnalysisBase };
