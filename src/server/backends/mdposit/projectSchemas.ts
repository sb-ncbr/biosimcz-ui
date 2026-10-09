import "server-only";
import { z } from "zod";

// Runtime schemas for the parts of the MDposit responses the app reads (shapes observed in docs/mdposit-contract.md; the
// generated types are only compile-time). Tolerant on purpose: a field of the wrong type becomes undefined instead of
// failing the whole record, and unknown keys (SEQUENCES, atom names, ...) are dropped.

const lenient = <T extends z.ZodType>(schema: T) => schema.nullish().catch(undefined);

const text = lenient(z.string());
const count = lenient(z.number());
const textList = lenient(z.array(z.string()));

const metadataSchema = z.object({
  NAME: text,
  DESCRIPTION: text,
  AUTHORS: textList,
  GROUPS: textList,
  PROGRAM: text,
  // A string on the live API, a number in the spec.
  VERSION: lenient(z.union([z.string(), z.number()])),
  TYPE: text,
  METHOD: text,
  LICENSE: text,
  LINKCENSE: text,
  CITATION: text,
  THANKS: text,
  CONTACT: text,
  // One string per chain; the old UI read these two, not the combined SEQUENCES.
  PROTSEQ: textList,
  NUCLSEQ: textList,
  LENGTH: count,
  TIMESTEP: count,
  FF: lenient(z.union([z.string(), z.array(z.string())])),
  TEMP: count,
  WAT: text,
  ENSEMBLE: text,
  SYSTATS: count,
  COLLECTIONS: textList,
  PDBIDS: textList,
  REFERENCES: textList,
  LINKS: lenient(z.array(z.unknown())),
  frameCount: count,
});

// One project, in a list or alone.
const projectSchema = z.object({
  accession: z.string().min(1),
  metadata: metadataSchema.nullish().catch(undefined),
  mds: textList,
  mdcount: count,
  files: textList,
  creationDate: text,
  updateDate: text,
  totalSize: count,
  totalFrames: count,
});

// One replica ("ACCESSION.N") as the live API returns it. Keys come from the real MD-A007L3.1 payload; most are null on some
// projects. Nucleic acids are DNA* plus RNA*; NOCNION (5 on the sample) has no known meaning and is not read.
const replicaMetadataSchema = z.object({
  FRAMESTEP: count,
  TIMESTEP: count,
  TEMP: count,
  ENSEMBLE: text,
  TYPE: text,
  FF: lenient(z.union([z.string(), z.array(z.string())])),
  WAT: text,
  // A single space-joined string on the live API ("orthorhombic triclinic"), not a list.
  BOXTYPE: lenient(z.union([z.string(), z.array(z.string())])),
  BOXSIZEX: count,
  BOXSIZEY: count,
  BOXSIZEZ: count,
  SYSTATS: count,
  SYSTRES: count,
  PROTATS: count,
  PROTRES: count,
  DNAATS: count,
  DNARES: count,
  RNAATS: count,
  RNARES: count,
  LIPIATS: count,
  LIPIRES: count,
  CARBATS: count,
  CARBRES: count,
  SOLVATS: count,
  SOLVRES: count,
  COUNCAT: count,
  COUNANI: count,
  COUNION: count,
  mdFrames: count,
  mdAtoms: count,
  // Items are free-form on the API (the spec types them as objects); the mapper turns each into one line of text.
  WARNINGS: lenient(z.array(z.unknown())),
});

// accession has no ".N" suffix here; the replica name comes from the route, not from this payload.
const replicaProjectSchema = z.object({
  accession: z.string().min(1),
  mds: textList,
  analyses: textList,
  metadata: replicaMetadataSchema.nullish().catch(undefined),
});

// Items stay unknown here: one invalid project is skipped by the adapter instead of failing the page.
const projectsEnvelopeSchema = z.object({
  filteredCount: z.number().int().nonnegative(),
  projects: z.array(z.unknown()),
});

// { "metadata.PROGRAM": { "GROMACS": 481, "null": 517 } }
const optionsSchema = z.record(z.string(), z.record(z.string(), z.number()));

const summarySchema = z.object({ projectsCount: z.number().int().nonnegative() });

type MdpositProject = z.infer<typeof projectSchema>;
type MdpositReplica = z.infer<typeof replicaProjectSchema>;
type MdpositMetadata = z.infer<typeof metadataSchema>;

export { optionsSchema, projectSchema, projectsEnvelopeSchema, replicaProjectSchema, summarySchema };
export type { MdpositMetadata, MdpositProject, MdpositReplica };
