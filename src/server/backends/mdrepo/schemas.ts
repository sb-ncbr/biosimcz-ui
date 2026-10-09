import { z } from "zod";
import { logger } from "../../lib/logger";

// Upstream ids may arrive as numbers; the app treats every id as a string.
const id = z.union([z.string(), z.number()]).transform(String);
const role = z.union([z.string(), z.object({ name: z.string() }).transform((value) => value.name)]);

// TODO(backend): E-P1 PROPOSED GET /api/me
const meSchema = z.looseObject({
  id,
  email: z.string(),
  display_name: z.string().nullish(),
  given_name: z.string().nullish(),
  family_name: z.string().nullish(),
  orcid: z.string().nullish(),
  avatar_url: z.string().nullish(),
  roles: z.array(role).default([]),
});

// #9-#14 InvenioRDM community hit; only fields the UI is known to read are typed.
const communitySchema = z.looseObject({
  id: z.string(),
  slug: z.string(),
  metadata: z.looseObject({ title: z.string(), description: z.string().optional() }),
  access: z.looseObject({ visibility: z.string().optional() }).optional(),
});

const communitySearchSchema = z.looseObject({
  hits: z.looseObject({ hits: z.array(communitySchema), total: z.number() }),
});

const communityCreateSchema = z.object({
  slug: z.string().min(1),
  metadata: z.object({ title: z.string().min(1), description: z.string().optional() }),
  access: z.object({ visibility: z.literal("public") }),
});

const communityUpdateSchema = communityCreateSchema.partial();

// #16 POST /api/experiments/. The old UI read either key; which one is real is a backend question.
const createDraftResponseSchema = z
  .looseObject({ id: z.string().optional(), record_id: z.string().optional() })
  .transform((value, ctx) => {
    const draftId = value.id ?? value.record_id;
    if (!draftId) {
      ctx.addIssue({ code: "custom", message: "Missing id" });
      return z.NEVER;
    }
    return { id: draftId };
  });

// Domain metadata schema arrives with entities/deposition (phase 3); the client treats it as opaque JSON.
const draftMetadataSchema = z.record(z.string(), z.unknown());

const draftFileSchema = z.looseObject({
  key: z.string(),
  size: z.number().optional(),
  checksum: z.string().optional(),
  status: z.enum(["pending", "completed"]),
  mimetype: z.string().optional(),
  created_at: z.string().optional(),
});

// TODO(backend): E-D1 PROPOSED
const draftReadSchema = z.looseObject({
  id: z.string(),
  status: z.string(),
  revision: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  owner_id: z.string().optional(),
  metadata: draftMetadataSchema,
  files: z.array(draftFileSchema),
  community_ids: z.array(z.string()).default([]),
  doi: z.string().nullish(),
});

// TODO(backend): E-D2 PROPOSED
const draftSaveResponseSchema = z.looseObject({ id: z.string(), revision: z.number(), updated_at: z.string() });

// TODO(backend): E-D3 PROPOSED
const publishResponseSchema = z.looseObject({
  id: z.string(),
  status: z.enum(["published", "in_review"]),
  record_url: z.string().nullish(),
  doi: z.string().nullish(),
  published_at: z.string().nullish(),
});

// TODO(backend): E-D6 PROPOSED
const DETECTED_ROLES = ["topology", "structure_and_box", "starting_structure", "run_input", "parameters", "trajectory", "other"] as const;
type DetectedRole = (typeof DETECTED_ROLES)[number];

// A role added by the backend later must not fail the whole parse (a 502); it degrades to "other".
const detectedRole = z.string().transform((value): DetectedRole => {
  if ((DETECTED_ROLES as readonly string[]).includes(value)) return value as DetectedRole;
  logger.warn("unknown parse detected_role, using \"other\"", { detected_role: value });
  return "other";
});

const parseResultSchema = z.looseObject({
  status: z.enum(["ok", "unreadable", "unsupported"]),
  detected_role: detectedRole.optional(),
  fields: z.array(z.object({ path: z.string(), value: z.unknown() })).default([]),
  warnings: z.array(z.looseObject({ code: z.string(), message: z.string().optional() })).default([]),
});

// TODO(backend): E-D7 PROPOSED
const doiResponseSchema = z.looseObject({ doi: z.string(), status: z.string() });

const bucketSchema = z.looseObject({ key: z.string(), label: z.string().optional(), count: z.number() });

// TODO(backend): E-L1 PROPOSED
const listMineSchema = z.looseObject({
  total: z.number(),
  page: z.number(),
  size: z.number(),
  counts_by_status: z.record(z.string(), z.number()).default({}),
  items: z.array(
    z.looseObject({
      id: z.string(),
      status: z.string(),
      title: z.string().nullable(),
      updated_at: z.string(),
      created_at: z.string(),
      published_at: z.string().nullable(),
      doi: z.string().nullable(),
      access: z.string().nullable(),
      community_ids: z.array(z.string()).default([]),
      has_preview: z.boolean().default(false),
      metadata: draftMetadataSchema.optional(),
    }),
  ),
  facets: z.record(z.string(), z.unknown()).default({}),
});

const facetBucketsSchema = z.looseObject({ items: z.array(bucketSchema) });

// TODO(backend): E-S1..E-S4 PROPOSED
const structureSearchSchema = z.looseObject({
  items: z.array(
    z.looseObject({
      source: z.string(),
      id: z.string(),
      title: z.string(),
      organism: z.string().nullish(),
      method: z.string().nullish(),
      resolution_A: z.number().nullish(),
    }),
  ),
});
const residueSchema = z.looseObject({ code: z.string(), name: z.string(), formula: z.string().optional() });
const keywordsSchema = z.looseObject({ items: z.array(z.looseObject({ keyword: z.string(), count: z.number() })) });
const orcidSchema = z.looseObject({
  orcid: z.string(),
  given_name: z.string().nullish(),
  family_name: z.string().nullish(),
  verified: z.boolean(),
});
const organisationsSchema = z.looseObject({
  items: z.array(z.looseObject({ ror_id: z.string(), name: z.string(), country: z.string().nullish() })),
});

export {
  communityCreateSchema,
  communitySchema,
  communitySearchSchema,
  communityUpdateSchema,
  createDraftResponseSchema,
  doiResponseSchema,
  draftReadSchema,
  draftSaveResponseSchema,
  facetBucketsSchema,
  keywordsSchema,
  listMineSchema,
  meSchema,
  orcidSchema,
  organisationsSchema,
  parseResultSchema,
  publishResponseSchema,
  residueSchema,
  structureSearchSchema,
};
