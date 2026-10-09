import "server-only";
import { ACCESS_VALUES, type AccessValue, type Creator } from "@/entities/deposition";
import {
  type RecordAuthor,
  type RecordDetail,
  type RecordFacetName,
  type RecordFacetOption,
  type RecordSearchResult,
  type RecordSummary,
} from "@/entities/record";
import type { z } from "zod";
import type { recordDetailSchema, recordItemSchema, recordSearchSchema } from "../../backends/mdrepo/recordSchemas";
import { authorLabel } from "../deposition/listMapper";
import { fromExperimentMetadata } from "../deposition/mapper";

// Anti-corruption layer for E-R1/E-R2 (PROPOSED): wire record -> domain record.
// TODO(backend): every field read here is from the proposal; the real response is UNKNOWN until the backend answers.

type WireItem = z.infer<typeof recordItemSchema>;
type WireSearch = z.infer<typeof recordSearchSchema>;
type WireDetail = z.infer<typeof recordDetailSchema>;
type Json = Record<string, unknown>;
type Draft = ReturnType<typeof fromExperimentMetadata>;
type Labels = ReadonlyMap<string, string>;

const obj = (value: unknown): Json | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Json) : undefined;
const str = (value: unknown): string | undefined => (typeof value === "string" && value !== "" ? value : undefined);
const num = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

const isAccess = (value: unknown): value is AccessValue => ACCESS_VALUES.some((known) => known === value);

// Full name for the record page; organisations keep their plain name.
const fullName = (author: Creator): string | null => {
  if (author.kind === "organization") return author.name?.trim() || null;
  const parts = [author.givenName?.trim(), author.familyName?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : author.name?.trim() || null;
};

const authorOf = (author: Creator): RecordAuthor[] => {
  const name = fullName(author);
  if (!name) return [];
  return [
    {
      name,
      orcid: author.orcid?.trim() || null,
      affiliations: (author.affiliations ?? []).flatMap((affiliation) => affiliation.name?.trim() || []),
    },
  ];
};

// Fields common to the list item and the detail; `draft` is the parsed study metadata both read their authors from.
const commonOf = (wire: WireItem, labels: Labels): { draft: Draft; fields: Omit<RecordSummary, "authors"> } => {
  const draft = fromExperimentMetadata(wire.metadata ?? {});
  const version = wire.version ?? undefined;
  return {
    draft,
    fields: {
      id: wire.id,
      title: wire.title?.trim() || draft.study.title?.trim() || null,
      description: draft.study.description?.trim() || null,
      publishedAt: wire.published_at ?? null,
      doi: wire.doi?.trim() || null,
      version: version !== undefined && version >= 1 ? version : null,
      access: isAccess(wire.access) ? wire.access : (draft.study.access ?? null),
      embargoUntil: draft.study.embargo?.until?.trim() || null,
      license: draft.study.license?.trim() || null,
      communities: wire.community_ids.map((id) => ({ id, label: labels.get(id) ?? id })),
      keywords: draft.study.keywords,
      accession: null,
      engine: null,
      waterModel: null,
      method: null,
      replicaCount: null,
      groups: [],
    },
  };
};

const summaryOf = (wire: WireItem, labels: Labels): RecordSummary => {
  const { draft, fields } = commonOf(wire, labels);
  return { ...fields, authors: draft.study.authors.flatMap((author) => authorLabel(author) ?? []) };
};

const optionsOf = (value: unknown): RecordFacetOption[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): RecordFacetOption[] => {
    const bucket = obj(entry);
    const key = str(bucket?.["key"]);
    const count = num(bucket?.["count"]);
    if (key === undefined || count === undefined) return [];
    return [{ key, label: str(bucket?.["label"]) ?? key, count }];
  });
};

// Domain facet name -> key in the E-R1 facet response (PROPOSED).
const FACET_KEYS = { access: "access", community: "community", software: "engine", keyword: "keyword" } as const;

const fromSearchResponse = (wire: WireSearch): RecordSearchResult => {
  const facets = Object.fromEntries(
    Object.entries(FACET_KEYS).map(([name, key]) => [name, optionsOf(wire.facets[key])]),
  ) as Partial<Record<RecordFacetName, RecordFacetOption[]>>;
  // The facet response carries the community titles; cards reuse them so they never show a bare id.
  const labels = new Map((facets.community ?? []).map((option) => [option.key, option.label]));
  return {
    total: wire.total,
    page: wire.page,
    size: wire.size,
    items: wire.items.map((item) => summaryOf(item, labels)),
    facets,
    repositoryTotal: null,
    facetsAvailable: true,
  };
};

const fromDetailResponse = (wire: WireDetail): RecordDetail => {
  const labels = new Map((wire.communities ?? []).flatMap((community) => (community.title ? [[community.id, community.title] as const] : [])));
  const { draft, fields } = commonOf(wire, labels);
  return {
    ...fields,
    authors: draft.study.authors.flatMap(authorOf),
    engine: draft.system.engine?.name?.trim() || null,
    files: wire.files === undefined ? null : wire.files.map((file) => ({ key: file.key, size: file.size ?? null, mimetype: file.mimetype ?? null })),
    simulation: null,
    licenseUrl: null,
    citation: null,
    acknowledgements: null,
    links: [],
    pdbIds: [],
    uniprotIds: [],
    contact: null,
    sequences: [],
    replicaNames: [],
    updatedAt: null,
    totalSize: null,
  };
};

export { fromDetailResponse, fromSearchResponse };
