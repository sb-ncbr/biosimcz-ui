import { z } from "zod";
import {
  ACCESS_VALUES,
  BOX_SHAPES,
  CREATOR_KINDS,
  ENSEMBLES,
  MOLECULE_TYPES,
  SIMULATION_TYPES,
  STRUCTURE_SOURCES,
} from "./enums";

// Lenient schema shared by client (pre-send) and server (route handler): every field is optional and only types and
// formats are enforced, so half-filled and empty drafts always save (U2). "Required" lives in schema.publish.ts.
// Format failures use stable codes as messages; the UI maps them to copy (missing-states 3.2).

const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/i;
const ROR_PATTERN = /^(?:https:\/\/ror\.org\/)?0[a-z0-9]{8}$/i;
const ORCID_PATTERN = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

// ISO 7064 mod 11-2, as ORCID specifies.
const isValidOrcid = (value: string): boolean => {
  if (!ORCID_PATTERN.test(value)) return false;
  const digits = value.replaceAll("-", "");
  let total = 0;
  for (const digit of digits.slice(0, 15)) total = (total + Number(digit)) * 2;
  const result = (12 - (total % 11)) % 11;
  return digits[15] === (result === 10 ? "X" : String(result));
};

const isValidIsoDate = (value: string): boolean => {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
};

// Blank strings are "not filled", never an error; the format only applies once something is typed.
const formatted = (test: (value: string) => boolean, code: string) =>
  z.string().refine((value) => value === "" || test(value), { message: code });

const doiField = formatted((value) => DOI_PATTERN.test(value), "invalid_doi");
const rorField = formatted((value) => ROR_PATTERN.test(value), "invalid_ror");
const orcidField = formatted(isValidOrcid, "invalid_orcid");
const dateField = formatted(isValidIsoDate, "invalid_date");

const text = z.string();
const positive = z.number().positive({ message: "not_positive" });
const positiveInt = z.number().int({ message: "not_integer" }).positive({ message: "not_positive" });
const angle = z.number().gt(0, { message: "angle_range" }).lt(180, { message: "angle_range" });

const affiliationSchema = z.object({ name: text, rorId: rorField.optional() });

const creatorSchema = z.object({
  kind: z.enum(CREATOR_KINDS).default("person"),
  givenName: text.optional(),
  familyName: text.optional(),
  // Organisations only; people are identified by given and family name.
  name: text.optional(),
  role: text.optional(),
  orcid: orcidField.optional(),
  rorId: rorField.optional(),
  affiliations: z.array(affiliationSchema).default([]),
});

const fundingSchema = z.object({
  funderName: text.optional(),
  funderRorId: rorField.optional(),
  awardNumber: text.optional(),
  awardTitle: text.optional(),
});

const relatedWorkSchema = z.object({
  identifier: text.optional(),
  scheme: text.optional(),
  relation: text.optional(),
});

const studySchema = z.object({
  title: text.optional(),
  doi: doiField.optional(),
  description: text.optional(),
  keywords: z.array(text).default([]),
  authors: z.array(creatorSchema).default([]),
  contributors: z.array(creatorSchema).default([]),
  funding: z.array(fundingSchema).default([]),
  communityId: text.optional(),
  access: z.enum(ACCESS_VALUES).optional(),
  embargo: z.object({ until: dateField.optional(), reason: text.optional() }).optional(),
  license: text.optional(),
  relatedWorks: z.array(relatedWorkSchema).default([]),
});

const moleculeSchema = z.object({
  type: z.enum(MOLECULE_TYPES).optional(),
  name: text.optional(),
  residueCode: text.optional(),
  count: positiveInt.optional(),
  chains: z.array(text).optional(),
  residues: positiveInt.optional(),
  parameters: text.optional(),
  generatedWith: text.optional(),
  chargeMethod: text.optional(),
  concentrationMM: positive.optional(),
  ions: z.array(z.object({ name: text, charge: z.number().int().optional(), count: positiveInt.optional() })).optional(),
});

const systemSchema = z.object({
  engine: z.object({ name: text.optional(), version: text.optional(), build: text.optional() }).optional(),
  forceField: text.optional(),
  waterModel: text.optional(),
  startingStructure: z
    .object({ source: z.enum(STRUCTURE_SOURCES).optional(), id: text.optional(), title: text.optional() })
    .optional(),
  molecules: z.array(moleculeSchema).default([]),
  systemSize: positiveInt.optional(),
  box: z
    .object({
      shape: z.enum(BOX_SHAPES).optional(),
      a: positive.optional(),
      b: positive.optional(),
      c: positive.optional(),
      alpha: angle.optional(),
      beta: angle.optional(),
      gamma: angle.optional(),
    })
    .optional(),
  // Provenance: field path -> file name that prefilled it ("from topol.top").
  fieldSources: z.record(z.string(), z.string()).default({}),
  // Keys of the committed system files (the files themselves live on the server draft).
  fileKeys: z.array(text).default([]),
});

const runSchema = z.object({
  // Identity, not user content: the URL segment of the run editor.
  id: z.string().regex(ID_PATTERN, { message: "invalid_id" }),
  name: text.optional(),
  simulationType: z.enum(SIMULATION_TYPES).optional(),
  ensemble: z.enum(ENSEMBLES).optional(),
  // ns for dynamics, steps for energy minimization (the unit follows the type).
  length: positive.optional(),
  timeStep: positive.optional(),
  outputInterval: positive.optional(),
  // A defined optional section object means "added": ghost sections turn into full sections.
  temperature: z
    .object({
      thermostat: text.optional(),
      referenceK: positive.optional(),
      couplingGroups: text.optional(),
      tauPs: positive.optional(),
    })
    .optional(),
  pressure: z
    .object({ barostat: text.optional(), referenceBar: z.number().optional(), couplingType: text.optional(), tauPs: positive.optional() })
    .optional(),
  electrostatics: z.object({ method: text.optional(), cutoffNm: positive.optional() }).optional(),
  vanDerWaals: z.object({ method: text.optional(), cutoffNm: positive.optional() }).optional(),
  constraints: z.object({ algorithm: text.optional(), type: text.optional() }).optional(),
  enhancedSampling: z.object({ method: text.optional() }).optional(),
  freeEnergy: z.object({ lambdaWindows: positiveInt.optional() }).optional(),
  motionRemoval: z.object({ mode: text.optional(), frequencySteps: positiveInt.optional() }).optional(),
  fileKeys: z.array(text).default([]),
});

const draftSchema = z.object({
  study: studySchema.prefault({}),
  system: systemSchema.prefault({}),
  runs: z.array(runSchema).default([]),
});

export { DOI_PATTERN, draftSchema, isValidIsoDate, isValidOrcid, runSchema, studySchema, systemSchema };
