// Option lists behind the enum fields. Values are ported from biosimcz-ui formOptions.ts where the old form had them;
// the rest follow the approved frames. TODO(backend): confirm value strings (backend-feature-requests section 3).
const ACCESS_VALUES = ["open", "restricted", "embargoed"] as const;
const CREATOR_KINDS = ["person", "organization"] as const;
const SIMULATION_TYPES = ["energy_minimization", "molecular_dynamics", "free_energy"] as const;
const ENSEMBLES = ["NVE", "NVT", "NpT"] as const;
const BOX_SHAPES = ["cubic", "rhombic-dodecahedron", "truncated-octahedron", "triclinic", "custom"] as const;
const MOLECULE_TYPES = ["protein", "nucleic", "lipid", "ligand", "water", "ions", "other"] as const;
const STRUCTURE_SOURCES = ["pdb", "alphafold", "custom"] as const;

type AccessValue = (typeof ACCESS_VALUES)[number];
type CreatorKind = (typeof CREATOR_KINDS)[number];
type SimulationType = (typeof SIMULATION_TYPES)[number];
type Ensemble = (typeof ENSEMBLES)[number];
type BoxShape = (typeof BOX_SHAPES)[number];
type MoleculeType = (typeof MOLECULE_TYPES)[number];
type StructureSource = (typeof STRUCTURE_SOURCES)[number];

const SIMULATION_TYPE_LABELS: Record<SimulationType, string> = {
  energy_minimization: "Energy minimization",
  molecular_dynamics: "Molecular dynamics",
  free_energy: "Free energy simulation",
};

// Box shapes whose angles are entered by hand (BC 132:23); fixed shapes hide them.
const BOX_SHAPES_WITH_ANGLES: readonly BoxShape[] = ["triclinic", "custom"];

export {
  ACCESS_VALUES,
  BOX_SHAPES,
  BOX_SHAPES_WITH_ANGLES,
  CREATOR_KINDS,
  ENSEMBLES,
  MOLECULE_TYPES,
  SIMULATION_TYPES,
  SIMULATION_TYPE_LABELS,
  STRUCTURE_SOURCES,
};
export type { AccessValue, BoxShape, CreatorKind, Ensemble, MoleculeType, SimulationType, StructureSource };
