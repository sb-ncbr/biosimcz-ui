import "server-only";
import {
  ACCESS_VALUES,
  computeCompleteness,
  FACET_NAMES,
  type AccessValue,
  type Creator,
  type DateBucket,
  type DepositionFacets,
  type DepositionList,
  type DepositionListItem,
  type DraftProgress,
  type FacetName,
  type FacetOption,
} from "@/entities/deposition";
import type { listMineSchema } from "../../backends/mdrepo/schemas";
import type { z } from "zod";
import { fromExperimentMetadata } from "./mapper";

// Anti-corruption layer for E-L1 (PROPOSED, backend-feature-requests section 3): wire list response -> domain list.
// TODO(backend): every field read here is from the proposal; the real response is UNKNOWN until the backend answers.

type ListMineResponse = z.infer<typeof listMineSchema>;
type Json = Record<string, unknown>;

const obj = (value: unknown): Json | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Json) : undefined;
const str = (value: unknown): string | undefined => (typeof value === "string" && value !== "" ? value : undefined);
const num = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

// "Novakova J." for a person, the plain name for an organisation; the byline of the card.
const authorLabel = (creator: Creator): string | null => {
  if (creator.kind === "organization") return creator.name?.trim() || null;
  const family = creator.familyName?.trim();
  const initial = creator.givenName?.trim().charAt(0).toUpperCase();
  if (family && initial) return `${family} ${initial}.`;
  return family || creator.givenName?.trim() || creator.name?.trim() || null;
};

const isAccess = (value: unknown): value is AccessValue => ACCESS_VALUES.some((known) => known === value);

const progressOf = (metadata: unknown): DraftProgress => {
  const result = computeCompleteness(fromExperimentMetadata(metadata));
  const attention = result.steps.find((step) => step.status === "error") ?? result.steps.find((step) => step.status !== "done");
  return {
    steps: result.steps.map((step) => ({ id: step.id, title: step.title, status: step.status })),
    requiredLeft: result.requiredLeft,
    completion: result.completion,
    attentionStep: attention?.id ?? null,
  };
};

const itemOf = (wire: ListMineResponse["items"][number]): DepositionListItem => {
  const kind = wire.status === "draft" ? "draft" : "published";
  const draft = wire.metadata !== undefined ? fromExperimentMetadata(wire.metadata) : undefined;
  const structure = draft?.system.startingStructure;
  const structureId = structure?.id?.trim();
  const version = num(wire["version"]);
  return {
    id: wire.id,
    kind,
    title: wire.title?.trim() || draft?.study.title?.trim() || null,
    authors: (draft?.study.authors ?? []).flatMap((creator) => authorLabel(creator) ?? []),
    structure: structure && (structureId || structure.source === "custom") ? { source: structure.source ?? null, id: structureId || null } : null,
    access: isAccess(wire.access) ? wire.access : (draft?.study.access ?? null),
    embargoUntil: draft?.study.embargo?.until?.trim() || null,
    license: draft?.study.license?.trim() || null,
    description: draft?.study.description?.trim() || null,
    createdAt: wire.created_at,
    updatedAt: wire.updated_at,
    publishedAt: wire.published_at,
    doi: wire.doi,
    version: version !== undefined && version >= 1 ? version : null,
    hasPreview: wire.has_preview,
    // A draft the backend sent without metadata (the proposal allows dropping it to save weight) counts as not started.
    progress: kind === "draft" ? progressOf(wire.metadata ?? {}) : null,
  };
};

const optionsOf = (value: unknown): FacetOption[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): FacetOption[] => {
    const bucket = obj(entry);
    const key = str(bucket?.["key"]);
    const count = num(bucket?.["count"]);
    if (key === undefined || count === undefined) return [];
    return [{ key, label: str(bucket?.["label"]) ?? key, count }];
  });
};

const createdBuckets = (value: unknown): DateBucket[] => {
  const buckets = obj(value)?.["buckets"];
  if (!Array.isArray(buckets)) return [];
  return buckets.flatMap((entry): DateBucket[] => {
    const bucket = obj(entry);
    const key = str(bucket?.["key"]);
    const count = num(bucket?.["count"]);
    return key !== undefined && count !== undefined && /^\d{4}(-\d{2})?$/.test(key) ? [{ key, count }] : [];
  });
};

const facetsOf = (wire: Record<string, unknown>): DepositionFacets => ({
  created: createdBuckets(wire["created"]),
  options: Object.fromEntries(FACET_NAMES.map((name) => [name, optionsOf(wire[name])])) as Record<FacetName, FacetOption[]>,
});

const fromListMineResponse = (wire: ListMineResponse): DepositionList => {
  const counts = wire.counts_by_status;
  const draftCount = counts["draft"] ?? 0;
  const publishedCount = counts["published"] ?? 0;
  return {
    total: wire.total,
    page: wire.page,
    size: wire.size,
    counts: { all: counts["all"] ?? draftCount + publishedCount, draft: draftCount, published: publishedCount },
    items: wire.items.map(itemOf),
    facets: facetsOf(wire.facets),
  };
};

export { authorLabel, fromListMineResponse };
