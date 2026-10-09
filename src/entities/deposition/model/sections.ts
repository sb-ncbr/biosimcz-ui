import { BOX_SHAPES_WITH_ANGLES } from "./enums";
import type { Creator, Run, Study, System } from "./types";

// Section registry: one row per section of steps 1-3 with the fields that count towards "N required" and "+ N optional".
// Status icons, accordion header hints, the sidebar, the review list and the publish rule all read it (plan D6).
// Layout follows final-approved.md (78:4477, 100:10152, 115:121, 191:23, 195:2572); where the frames disagree with each
// other the resolution is written in plans/mdrepo-new-ui-p4-notes.md.

type StepId = "study" | "system" | "experiments";

type FieldSpec<Scope> = {
  // Dot path relative to the scope; also the field anchor for "Go to field".
  path: string;
  label: string;
  required: boolean | ((scope: Scope) => boolean);
  // False = the field is not shown, so it neither counts as required nor as optional (conditional fields).
  applies?: (scope: Scope) => boolean;
  // Default: the value at `path` is not blank.
  filled?: (scope: Scope) => boolean;
  // Paths (relative) whose format issues belong to this field; default [path].
  issuePaths?: readonly string[];
};

type SectionSpec<Scope> = {
  id: string;
  title: string;
  description: string;
  fields: readonly FieldSpec<Scope>[];
  applies?: (scope: Scope) => boolean;
  // Ghost sections ("Sections you can add"): only counted once the run carries this key.
  addableKey?: keyof Run;
};

const isBlank = (value: unknown): boolean => {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "number") return !Number.isFinite(value);
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.values(value).every(isBlank);
  return false;
};

const getAt = (scope: unknown, path: string): unknown => {
  let current: unknown = scope;
  for (const key of path.split(".")) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
};

const isFieldFilled = <Scope>(field: FieldSpec<Scope>, scope: Scope): boolean =>
  field.filled ? field.filled(scope) : !isBlank(getAt(scope, field.path));

const isFieldRequired = <Scope>(field: FieldSpec<Scope>, scope: Scope): boolean =>
  typeof field.required === "function" ? field.required(scope) : field.required;

const isNamed = (creator: Creator): boolean =>
  creator.kind === "organization"
    ? !isBlank(creator.name)
    : !isBlank(creator.givenName) || !isBlank(creator.familyName);

const allNumbers = (...values: (number | undefined)[]): boolean => values.every((value) => typeof value === "number");

// ---- Step 1: Study details ---------------------------------------------------------------------------------------

const STUDY_SECTIONS: readonly SectionSpec<Study>[] = [
  {
    id: "basics",
    title: "Basics",
    description: "General information about the dataset",
    fields: [
      { path: "title", label: "Title", required: true },
      { path: "description", label: "Description", required: true },
      { path: "doi", label: "DOI", required: false },
      { path: "keywords", label: "Keywords", required: false },
    ],
  },
  {
    id: "credits",
    title: "Credits",
    description: "Who made and funded this dataset.",
    fields: [
      { path: "authors", label: "Authors", required: true, filled: (study) => study.authors.some(isNamed) },
      { path: "contributors", label: "Contributors", required: false },
      { path: "funding", label: "Funding", required: false },
    ],
  },
  {
    id: "publishing",
    title: "Publishing",
    description: "Where the record lives and who can use the data.",
    fields: [
      { path: "communityId", label: "Community", required: true },
      { path: "access", label: "Access", required: true },
      { path: "embargo.until", label: "Open on", required: true, applies: (study) => study.access === "embargoed" },
      { path: "embargo.reason", label: "Reason", required: false, applies: (study) => study.access === "embargoed" },
      { path: "license", label: "License", required: true },
    ],
  },
  {
    id: "relatedWork",
    title: "Related work",
    description: "Connect this dataset to papers, structures, and funding.",
    fields: [{ path: "relatedWorks", label: "Related work", required: false }],
  },
];

// ---- Step 2: Molecular system ------------------------------------------------------------------------------------

const hasAngles = (system: System): boolean => system.box?.shape !== undefined && BOX_SHAPES_WITH_ANGLES.includes(system.box.shape);

const SYSTEM_SECTIONS: readonly SectionSpec<System>[] = [
  {
    id: "systemFiles",
    title: "System files",
    description: "Topology, structure and parameter files.",
    fields: [{ path: "fileKeys", label: "System files", required: true }],
  },
  {
    id: "engine",
    title: "Engine",
    description: "The software that ran your simulation.",
    fields: [
      { path: "engine.name", label: "Engine", required: true },
      { path: "engine.version", label: "Version", required: true },
      { path: "engine.build", label: "Build", required: false },
    ],
  },
  {
    id: "composition",
    title: "Composition",
    description: "What the system is made of and how it's parametrized.",
    fields: [
      {
        path: "startingStructure",
        label: "Starting structure",
        required: true,
        filled: (system) => !isBlank(system.startingStructure?.id) || system.startingStructure?.source === "custom",
      },
      { path: "forceField", label: "Force field", required: true },
      { path: "molecules", label: "Molecules", required: false },
    ],
  },
  {
    id: "dimensions",
    title: "Dimensions",
    description: "How big the system is and what box it sits in.",
    fields: [
      { path: "box.shape", label: "Box shape", required: false },
      { path: "systemSize", label: "System size", required: true },
      {
        path: "box.vectors",
        label: "Box vectors",
        required: true,
        filled: (system) => allNumbers(system.box?.a, system.box?.b, system.box?.c),
        issuePaths: ["box.a", "box.b", "box.c"],
      },
      {
        path: "box.angles",
        label: "Box angles",
        required: true,
        applies: hasAngles,
        filled: (system) => allNumbers(system.box?.alpha, system.box?.beta, system.box?.gamma),
        issuePaths: ["box.alpha", "box.beta", "box.gamma"],
      },
    ],
  },
];

// ---- Step 3: one run ---------------------------------------------------------------------------------------------

// Which sections a run shows depends on its type (195:2572 shows only files and Basics until a type is chosen; the
// 186:1099 table shows no ensemble, temperature or pressure for energy minimization). Free energy behaves like dynamics.
const hasType = (run: Run): boolean => run.simulationType !== undefined;
const isDynamic = (run: Run): boolean => hasType(run) && run.simulationType !== "energy_minimization";
const wantsTemperature = (run: Run): boolean => isDynamic(run) && (run.ensemble === "NVT" || run.ensemble === "NpT");
const wantsPressure = (run: Run): boolean => isDynamic(run) && run.ensemble === "NpT";

const RUN_SECTIONS: readonly SectionSpec<Run>[] = [
  {
    id: "files",
    title: "Experiment files",
    description: "Parameters and output files for this run.",
    fields: [{ path: "fileKeys", label: "Experiment files", required: true }],
  },
  {
    id: "basics",
    title: "Basics",
    description: "What kind of run this was and how long it ran.",
    fields: [
      { path: "name", label: "Name", required: true },
      { path: "simulationType", label: "Simulation type", required: true },
      { path: "ensemble", label: "Ensemble", required: true, applies: isDynamic },
      { path: "length", label: "Length", required: true, applies: hasType },
      { path: "timeStep", label: "Time step", required: true, applies: isDynamic },
      { path: "outputInterval", label: "Output interval", required: false, applies: isDynamic },
    ],
  },
  {
    id: "temperature",
    title: "Temperature",
    description: "Thermostat and target temperature.",
    applies: wantsTemperature,
    fields: [
      { path: "temperature.thermostat", label: "Thermostat", required: true },
      { path: "temperature.referenceK", label: "Reference temperature", required: true },
      { path: "temperature.couplingGroups", label: "Coupling groups", required: false },
    ],
  },
  {
    id: "pressure",
    title: "Pressure",
    description: "Barostat and target pressure.",
    applies: wantsPressure,
    fields: [
      { path: "pressure.barostat", label: "Barostat", required: true },
      { path: "pressure.referenceBar", label: "Reference pressure", required: true },
      { path: "pressure.couplingType", label: "Coupling type", required: false },
    ],
  },
  {
    id: "electrostatics",
    title: "Electrostatics",
    description: "PME, cut-off, grid spacing",
    applies: hasType,
    addableKey: "electrostatics",
    fields: [
      { path: "electrostatics.method", label: "Method", required: false },
      { path: "electrostatics.cutoffNm", label: "Cut-off", required: false },
    ],
  },
  {
    id: "vanDerWaals",
    title: "Van der Waals",
    description: "Cut-off scheme, dispersion correction",
    applies: hasType,
    addableKey: "vanDerWaals",
    fields: [
      { path: "vanDerWaals.method", label: "Method", required: false },
      { path: "vanDerWaals.cutoffNm", label: "Cut-off", required: false },
    ],
  },
  {
    id: "constraints",
    title: "Constraints",
    description: "LINCS or SHAKE, constrained bonds",
    applies: hasType,
    addableKey: "constraints",
    fields: [
      { path: "constraints.algorithm", label: "Algorithm", required: false },
      { path: "constraints.type", label: "Constrained bonds", required: false },
    ],
  },
  {
    id: "enhancedSampling",
    title: "Enhanced sampling",
    description: "Restraints, umbrella sampling, AWH",
    applies: hasType,
    addableKey: "enhancedSampling",
    fields: [{ path: "enhancedSampling.method", label: "Method", required: false }],
  },
  {
    id: "freeEnergy",
    title: "Free energy",
    description: "Lambda windows, soft-core, decoupling",
    applies: hasType,
    addableKey: "freeEnergy",
    fields: [{ path: "freeEnergy.lambdaWindows", label: "Lambda windows", required: false }],
  },
  {
    id: "motionRemoval",
    title: "Motion removal",
    description: "COM motion mode and frequency",
    applies: hasType,
    addableKey: "motionRemoval",
    fields: [
      { path: "motionRemoval.mode", label: "Mode", required: false },
      { path: "motionRemoval.frequencySteps", label: "Frequency", required: false },
    ],
  },
];

type StepSpec = { id: StepId; title: string; segment: string; eyebrow: string };

const STEPS: readonly StepSpec[] = [
  { id: "study", title: "Study details", segment: "study", eyebrow: "Step 1 of 3" },
  { id: "system", title: "Molecular system", segment: "system", eyebrow: "Step 2 of 3" },
  { id: "experiments", title: "Experiments", segment: "experiments", eyebrow: "Step 3 of 3" },
];

// Sections that can still be added to a run (rendered as ghost cards).
const ghostSections = (run: Run): readonly SectionSpec<Run>[] =>
  RUN_SECTIONS.filter((section) => section.addableKey !== undefined && (section.applies?.(run) ?? true) && run[section.addableKey] === undefined);

const fieldAnchor = (sectionId: string, path: string): string => `field-${sectionId}-${path.replaceAll(".", "-")}`;

export {
  fieldAnchor,
  getAt,
  ghostSections,
  isBlank,
  isFieldFilled,
  isFieldRequired,
  RUN_SECTIONS,
  STEPS,
  STUDY_SECTIONS,
  SYSTEM_SECTIONS,
};
export type { FieldSpec, SectionSpec, StepId, StepSpec };
