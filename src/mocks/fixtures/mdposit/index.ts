import replica from "./replica/MD-A007L3.1.json";
import a0 from "./analyses/clusters-00.json";
import a1 from "./analyses/clusters-01.json";
import a2 from "./analyses/dist-perres-00.json";
import a3 from "./analyses/energies-00.json";
import a4 from "./analyses/hbonds-00.json";
import a5 from "./analyses/interactions.json";
import a6 from "./analyses/rmsd-pairwise-00.json";
import a7 from "./analyses/rmsd-pairwise-01.json";
import a8 from "./analyses/pca.json";
import a9 from "./analyses/rmsd-perres.json";
import a10 from "./analyses/pockets.json";
import a11 from "./analyses/rgyr.json";
import a12 from "./analyses/rmsds.json";
import a13 from "./analyses/fluctuation.json";
import a14 from "./analyses/sasa.json";
import a15 from "./analyses/tmscores.json";
import syntheticApl from "./analyses/synthetic/apl.json";
import syntheticDensity from "./analyses/synthetic/density.json";
import syntheticLipidInter from "./analyses/synthetic/lipid-inter.json";
import syntheticLipidOrder from "./analyses/synthetic/lipid-order.json";
import syntheticMemMap from "./analyses/synthetic/mem-map.json";
import syntheticThickness from "./analyses/synthetic/thickness.json";
import syntheticRmsd from "./analyses/synthetic/rmsd.json";
import syntheticPairwiseInterface from "./analyses/synthetic/rmsd-pairwise-interface.json";
import o0 from "./analysis-options/clusters.json";
import o1 from "./analysis-options/dist-perres.json";
import o2 from "./analysis-options/energies.json";
import o3 from "./analysis-options/hbonds.json";
import o4 from "./analysis-options/rmsd-pairwise.json";

// Captured from the live MDposit API (see plans/experiment-details-fixture-findings.md), trimmed by scripts/capture-mdposit-fixtures.ts.
const replicaFixture: Record<string, unknown> = replica;

const analysisData: Record<string, unknown> = {
  "clusters-00": a0,
  "clusters-01": a1,
  "dist-perres-00": a2,
  "energies-00": a3,
  "hbonds-00": a4,
  "interactions": a5,
  "rmsd-pairwise-00": a6,
  "rmsd-pairwise-01": a7,
  "pca": a8,
  "rmsd-perres": a9,
  "pockets": a10,
  "rgyr": a11,
  "rmsds": a12,
  "fluctuation": a13,
  "sasa": a14,
  "tmscores": a15,
  // Synthetic, fixture-only: rmsd is 404 on MD-A007L3.1, so this is shaped like the old RMSDAnalysis type plus start/step. Stage 7 replaces it.
  "rmsd": syntheticRmsd,
  // Synthetic, fixture-only: the six membrane analyses are 404 on MD-A007L3.1; hand-built from the old mdpositTypes.ts shapes, so
  // the semantics (units, apl median/std shape) are UNKNOWN. Stage 7 replaces them.
  "apl": syntheticApl,
  "density": syntheticDensity,
  "lipid-inter": syntheticLipidInter,
  "lipid-order": syntheticLipidOrder,
  "mem-map": syntheticMemMap,
  "thickness": syntheticThickness,
  // Synthetic, fixture-only: rmsd-pairwise-interface is 404 on MD-A007L3.1; shaped like the live rmsd-pairwise payload.
  "rmsd-pairwise-interface": syntheticPairwiseInterface,
};

const analysisOptions: Record<string, unknown> = {
  "clusters": o0,
  "dist-perres": o1,
  "energies": o2,
  "hbonds": o3,
  "rmsd-pairwise": o4,
};

// `interactions` is data on the live API even though it has no numbered variants.
const analysisFixture = (name: string): unknown => analysisData[name];

const analysisOptionsFixture = (base: string): unknown => analysisOptions[base];

const analysisFixtureNames: string[] = (replica.analyses as string[]).slice();

export { analysisFixture, analysisFixtureNames, analysisOptionsFixture, replicaFixture };
