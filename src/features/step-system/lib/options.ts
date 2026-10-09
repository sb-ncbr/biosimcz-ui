import { BOX_SHAPES, MOLECULE_TYPES, type BoxShape, type Molecule, type MoleculeType } from "@/entities/deposition";
import type { IconName } from "@/shared/ui/icons";

// TODO(backend): engine, version and force field lists are placeholders until the backend publishes them.
const ENGINES: Record<string, readonly string[]> = {
  GROMACS: ["2025.2", "2024.4", "2023.5", "2023.1", "2022.6", "2021.7", "2020.7"],
  AMBER: ["24", "22", "20", "18"],
  NAMD: ["3.0", "2.14", "2.13"],
  OpenMM: ["8.2", "8.1", "8.0", "7.7"],
  CHARMM: ["c49b1", "c47b2"],
  LAMMPS: ["29Aug2024", "2Aug2023"],
};

const FORCE_FIELDS = ["CHARMM36m", "CHARMM36", "AMBER ff14SB", "AMBER ff19SB", "GAFF2", "OPLS-AA/M", "GROMOS 54A7", "Martini 3"] as const;

const PARAMETER_SETS = ["CGenFF", "GAFF2", "OPLS-AA", "GROMOS ATB", "Other"] as const;

const BOX_SHAPE_LABELS: Record<BoxShape, string> = {
  cubic: "Cubic",
  "rhombic-dodecahedron": "Rhombic dodecahedron",
  "truncated-octahedron": "Truncated octahedron",
  triclinic: "Triclinic",
  custom: "Custom",
};

const MOLECULE_LABELS: Record<MoleculeType, string> = {
  protein: "Protein",
  nucleic: "Nucleic",
  lipid: "Lipid",
  ligand: "Ligand",
  water: "Water",
  ions: "Ions",
  other: "Other",
};

// Only four tile images exist in the shared icons (protein, ligand, water, ions); the other types reuse the neutral one.
const MOLECULE_ICONS: Record<MoleculeType, IconName> = {
  protein: "mol-protein-22",
  nucleic: "mol-thumb-22",
  lipid: "mol-thumb-22",
  ligand: "mol-ligand-22",
  water: "mol-water-22",
  ions: "mol-ions-22",
  other: "mol-thumb-22",
};

const plural = (count: number, one: string, many = `${one}s`): string => `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`;

// "Protein - 1 chain - 129 residues" (115:121 uses middle dots; ASCII hyphens here per missing-states copy rules).
const describeMolecule = (molecule: Molecule): { title: string; sub: string } => {
  const type = molecule.type ? MOLECULE_LABELS[molecule.type] : "Molecule";
  const parts: (string | undefined)[] = [molecule.type === "water" ? "Solvent" : type];
  if (molecule.type === "protein" || molecule.type === "nucleic") {
    parts.push(molecule.chains?.length ? plural(molecule.chains.length, "chain") : undefined);
    parts.push(molecule.residues ? plural(molecule.residues, "residue") : undefined);
  } else if (molecule.type === "ligand") {
    if (molecule.residueCode) parts[0] = `Ligand ${molecule.residueCode}`;
    parts.push(molecule.count ? plural(molecule.count, "copy", "copies") : undefined);
    parts.push(molecule.parameters);
  } else if (molecule.type === "water") {
    parts.push(molecule.count ? plural(molecule.count, "molecule") : undefined);
    parts.push(molecule.parameters);
  } else if (molecule.type === "ions") {
    parts.push(molecule.concentrationMM ? `${molecule.concentrationMM / 1000} mol/l` : undefined);
  } else {
    parts.push(molecule.count ? plural(molecule.count, "copy", "copies") : undefined);
    parts.push(molecule.parameters);
  }
  const title =
    molecule.name?.trim() ||
    (molecule.ions?.length ? molecule.ions.map((ion) => `${ion.name} ${ion.count ?? ""}`.trim()).join(" - ") : "Unnamed molecule");
  return { title, sub: parts.filter(Boolean).join(" - ") };
};

export {
  BOX_SHAPE_LABELS,
  BOX_SHAPES,
  describeMolecule,
  ENGINES,
  FORCE_FIELDS,
  MOLECULE_ICONS,
  MOLECULE_LABELS,
  MOLECULE_TYPES,
  PARAMETER_SETS,
  plural,
};
