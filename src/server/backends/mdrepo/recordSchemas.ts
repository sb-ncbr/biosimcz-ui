import { z } from "zod";

// TODO(backend): E-R1 / E-R2 PROPOSED (backend-feature-requests section 3b). If the backend confirms InvenioRDM's
// own /api/records shape (hits.hits, aggregations), only this file and the repository mapper change.

const id = z.union([z.string(), z.number()]).transform(String);

const recordItemSchema = z.looseObject({
  id,
  title: z.string().nullish(),
  published_at: z.string().nullish(),
  updated_at: z.string().nullish(),
  doi: z.string().nullish(),
  version: z.number().nullish(),
  access: z.string().nullish(),
  community_ids: z.array(z.string()).default([]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const recordSearchSchema = z.looseObject({
  total: z.number(),
  page: z.number(),
  size: z.number(),
  items: z.array(recordItemSchema),
  facets: z.record(z.string(), z.unknown()).default({}),
});

const recordFileSchema = z.looseObject({
  key: z.string(),
  size: z.number().nullish(),
  mimetype: z.string().nullish(),
  checksum: z.string().nullish(),
});

const recordDetailSchema = recordItemSchema.extend({
  files: z.array(recordFileSchema).optional(),
  communities: z.array(z.looseObject({ id, slug: z.string().nullish(), title: z.string().nullish() })).optional(),
});

export { recordDetailSchema, recordItemSchema, recordSearchSchema };
