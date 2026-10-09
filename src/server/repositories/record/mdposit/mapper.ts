import "server-only";
import type { RecordDetail, RecordFacetName, RecordFacetOption, RecordLink, RecordSequence, RecordSummary, SimulationFacts } from "@/entities/record";
import type { MdpositMetadata, MdpositProject } from "../../../backends/mdposit/projectSchemas";
import { FACET_FIELDS, MAX_VALUE_CHARS } from "./queryBuilder";

// Anti-corruption layer: MDposit ProjectMD (shapes in docs/mdposit-contract.md) -> domain records. Every read is tolerant,
// many fields are null on real projects.

const MAX_FILES = 500;
const MAX_OPTIONS = 100;

const clean = (value: string | null | undefined): string | null => {
  const text = value?.trim();
  return text ? text : null;
};

const cleanAll = (values: readonly string[] | null | undefined): string[] => (values ?? []).flatMap((value) => clean(value) ?? []);

const meta = (project: MdpositProject): MdpositMetadata | undefined => project.metadata ?? undefined;

const engineOf = (metadata: MdpositMetadata | undefined): string | null => {
  const program = clean(metadata?.PROGRAM);
  if (program === null) return null;
  const version = metadata?.VERSION;
  const text = typeof version === "number" ? String(version) : clean(version);
  return text === null ? program : `${program} ${text}`;
};

// Only http(s) URLs are links; anything else (javascript:, data:, relative) is dropped.
const safeUrl = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
};

const linksOf = (raw: readonly unknown[] | null | undefined): RecordLink[] =>
  (raw ?? []).flatMap((entry): RecordLink[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const { url, name } = entry as { url?: unknown; name?: unknown };
    const href = safeUrl(url);
    if (href === null) return [];
    return [{ label: typeof name === "string" && name.trim() !== "" ? name.trim() : href, url: href }];
  });

const finite = (value: number | null | undefined): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

const replicasOf = (project: MdpositProject): number | null => finite(project.mdcount) ?? (project.mds ? project.mds.length : null);

const toSummary = (project: MdpositProject): RecordSummary => {
  const metadata = meta(project);
  return {
    id: project.accession,
    title: clean(metadata?.NAME),
    authors: cleanAll(metadata?.AUTHORS),
    description: clean(metadata?.DESCRIPTION),
    publishedAt: clean(project.creationDate),
    doi: null,
    version: null,
    access: null,
    embargoUntil: null,
    license: null,
    communities: [],
    keywords: [],
    accession: project.accession,
    engine: engineOf(metadata),
    waterModel: clean(metadata?.WAT),
    method: clean(metadata?.METHOD),
    replicaCount: replicasOf(project),
    groups: cleanAll(metadata?.GROUPS),
  };
};

const simulationOf = (project: MdpositProject): SimulationFacts => {
  const metadata = meta(project);
  const ff = metadata?.FF;
  return {
    method: clean(metadata?.METHOD),
    type: clean(metadata?.TYPE),
    ensemble: clean(metadata?.ENSEMBLE),
    forceFields: typeof ff === "string" ? cleanAll([ff]) : cleanAll(ff),
    waterModel: clean(metadata?.WAT),
    temperature: finite(metadata?.TEMP),
    timestep: finite(metadata?.TIMESTEP),
    lengthNs: finite(metadata?.LENGTH),
    atoms: finite(metadata?.SYSTATS),
    frames: finite(metadata?.frameCount) ?? finite(project.totalFrames),
    replicas: replicasOf(project),
  };
};

// Whitespace inside a sequence is formatting, not residues.
const sequencesOf = (metadata: MdpositMetadata | undefined): RecordSequence[] => [
  ...cleanAll(metadata?.PROTSEQ).map((sequence) => ({ kind: "protein" as const, sequence: sequence.replace(/\s+/g, "") })),
  ...cleanAll(metadata?.NUCLSEQ).map((sequence) => ({ kind: "nucleic" as const, sequence: sequence.replace(/\s+/g, "") })),
];

const toDetail =(project: MdpositProject): RecordDetail => {
  const metadata = meta(project);
  return {
    ...toSummary(project),
    authors: cleanAll(metadata?.AUTHORS).map((name) => ({ name, orcid: null, affiliations: [] })),
    // The MDposit file list is names only, no sizes.
    files: (project.files ?? []).slice(0, MAX_FILES).map((key) => ({ key, size: null, mimetype: null })),
    simulation: simulationOf(project),
    license: clean(metadata?.LICENSE),
    licenseUrl: safeUrl(metadata?.LINKCENSE),
    citation: clean(metadata?.CITATION),
    acknowledgements: clean(metadata?.THANKS),
    links: linksOf(metadata?.LINKS),
    pdbIds: cleanAll(metadata?.PDBIDS),
    uniprotIds: cleanAll(metadata?.REFERENCES),
    contact: clean(metadata?.CONTACT),
    sequences: sequencesOf(metadata),
    replicaNames: cleanAll(project.mds),
    updatedAt: clean(project.updateDate),
    totalSize: finite(project.totalSize),
  };
};

// { "metadata.PROGRAM": { "GROMACS": 481, "null": 517 } } -> options. "null" means "no value" and is dropped.
const toFacetOptions = (facet: RecordFacetName, data: Record<string, Record<string, number>>): RecordFacetOption[] => {
  const field = FACET_FIELDS[facet]?.field;
  const buckets = field === undefined ? undefined : data[field];
  if (!buckets) return [];
  const numeric = FACET_FIELDS[facet]?.kind === "in-number";
  return Object.entries(buckets)
    .filter(([key, count]) => key !== "null" && key.trim() !== "" && key.length <= MAX_VALUE_CHARS && !key.startsWith("$") && Number.isFinite(count))
    .map(([key, count]): RecordFacetOption => ({ key, label: key, count }))
    .sort((a, b) =>
      numeric ? Number(a.key) - Number(b.key) : (b.count ?? 0) - (a.count ?? 0) || a.label.localeCompare(b.label),
    )
    .slice(0, MAX_OPTIONS);
};

export { toDetail, toFacetOptions, toSummary };
