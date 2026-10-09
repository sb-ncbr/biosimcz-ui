import "server-only";
import type { z } from "zod";
import { request, requestRaw, requestVoid, type RequestOptions } from "../../http/request";
import type { UpstreamAuth } from "../../session/types";
import {
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
} from "./schemas";

// Applies the bearer header from withUpstream; the transport itself knows nothing about auth.
const withAuth = (auth: UpstreamAuth | undefined, options: RequestOptions = {}): RequestOptions => ({
  ...options,
  headers: { ...auth?.headers, ...options.headers },
});

const get = <T>(path: readonly (string | number)[], schema: z.ZodType<T>, auth?: UpstreamAuth, options?: RequestOptions) =>
  request("mdrepo", "GET", path, schema, withAuth(auth, options));

const send = <T>(
  method: string,
  path: readonly (string | number)[],
  schema: z.ZodType<T>,
  auth: UpstreamAuth | undefined,
  options?: RequestOptions,
) => request("mdrepo", method, path, schema, withAuth(auth, options));

const sendVoid = (method: string, path: readonly (string | number)[], auth: UpstreamAuth | undefined, options?: RequestOptions) =>
  requestVoid("mdrepo", method, path, withAuth(auth, options));

// ---- Identity -------------------------------------------------------------

// TODO(backend): E-P1 PROPOSED path /api/me
const getMe = (auth: UpstreamAuth) => get(["api", "me"], meSchema, auth);

// ---- Communities (#9-logo upload) ---------------------------------------------------

type CommunityQuery = { q?: string; sort?: string; size?: number; page?: number };

const listCommunities = (query: CommunityQuery, auth?: UpstreamAuth) =>
  get(["api", "communities"], communitySearchSchema, auth, { query });

const getCommunity = (idOrSlug: string, auth?: UpstreamAuth) => get(["api", "communities", idOrSlug], communitySchema, auth);

const createCommunity = (payload: z.infer<typeof communityCreateSchema>, auth: UpstreamAuth) =>
  send("POST", ["api", "communities"], communitySchema, auth, { json: communityCreateSchema.parse(payload), retry: false });

const updateCommunity = (idOrSlug: string, payload: z.infer<typeof communityUpdateSchema>, auth: UpstreamAuth) =>
  send("PUT", ["api", "communities", idOrSlug], communitySchema, auth, { json: communityUpdateSchema.parse(payload) });

// Real success body is UNKNOWN (Invenio usually answers 204), so nothing is parsed.
const deleteCommunity = (idOrSlug: string, auth: UpstreamAuth) => sendVoid("DELETE", ["api", "communities", idOrSlug], auth);

const renameCommunity = (idOrSlug: string, slug: string, auth: UpstreamAuth) =>
  send("POST", ["api", "communities", idOrSlug, "rename"], communitySchema, auth, { json: { slug }, retry: false });

// Raw Response so the route handler can stream the image.
const getCommunityLogo = (idOrSlug: string, auth?: UpstreamAuth) =>
  requestRaw("mdrepo", "GET", ["api", "communities", idOrSlug, "logo"], withAuth(auth, { headers: { Accept: "image/*" } }));

// Known to answer 502 upstream; callers keep it behind a feature flag.
const uploadCommunityLogo = (idOrSlug: string, logo: FormData, auth: UpstreamAuth) =>
  sendVoid("POST", ["api", "communities", idOrSlug, "logo"], auth, { body: logo, retry: false });

// ---- Experiments / drafts (#16-#19) -------------------------------------------

// #16. An empty draft is accepted (U2).
// TODO(backend): confirm the exact empty request ({} vs { metadata: {} }, files.enabled) and id field (backend doc section 5, item 3).
const createDraft = (auth: UpstreamAuth) =>
  send("POST", ["api", "experiments", ""], createDraftResponseSchema, auth, { json: {}, retry: false });

// #17
const initDraftFile = (draftId: string, key: string, auth: UpstreamAuth) =>
  sendVoid("POST", ["api", "experiments", draftId, "draft", "files"], auth, { json: [{ key }], retry: false });

// #18. Streams the body through; no timeout, no retry (a consumed stream cannot be replayed).
const putDraftFileContent = (draftId: string, key: string, body: ReadableStream | Blob, auth: UpstreamAuth, size?: number) =>
  sendVoid("PUT", ["api", "experiments", draftId, "draft", "files", key, "content"], auth, {
    body: body as BodyInit,
    headers: { "Content-Type": "application/octet-stream", ...(size !== undefined && { "Content-Length": String(size) }) },
    timeoutMs: null,
    retry: false,
  });

// #19
const commitDraftFile = (draftId: string, key: string, auth: UpstreamAuth) =>
  sendVoid("POST", ["api", "experiments", draftId, "draft", "files", key, "commit"], auth, { retry: false });

// ---- PROPOSED deposition endpoints (backend-feature-requests section 3) ----------

// TODO(backend): E-D1 path unconfirmed
const readDraft = (draftId: string, auth: UpstreamAuth) => get(["api", "experiments", draftId, "draft"], draftReadSchema, auth);

// TODO(backend): E-D2 path unconfirmed; revision travels in If-Match
const saveDraft = (draftId: string, metadata: Record<string, unknown>, revision: number, auth: UpstreamAuth) =>
  send("PUT", ["api", "experiments", draftId, "draft"], draftSaveResponseSchema, auth, {
    json: { metadata },
    headers: { "If-Match": String(revision) },
  });

// TODO(backend): E-D3 path unconfirmed
const publishDraft = (draftId: string, revision: number, auth: UpstreamAuth) =>
  send("POST", ["api", "experiments", draftId, "draft", "actions", "publish"], publishResponseSchema, auth, {
    json: { revision },
    retry: false,
  });

// TODO(backend): E-D4 path unconfirmed
const deleteDraft = (draftId: string, auth: UpstreamAuth) => sendVoid("DELETE", ["api", "experiments", draftId, "draft"], auth);

// TODO(backend): E-D5 path unconfirmed
const deleteDraftFile = (draftId: string, key: string, auth: UpstreamAuth) =>
  sendVoid("DELETE", ["api", "experiments", draftId, "draft", "files", key], auth);

// TODO(backend): E-D6 path unconfirmed
const parseDraftFile = (draftId: string, key: string, auth: UpstreamAuth) =>
  send("POST", ["api", "experiments", draftId, "draft", "files", key, "parse"], parseResultSchema, auth, { retry: false });

// TODO(backend): E-D7 path unconfirmed
const reserveDoi = (draftId: string, auth: UpstreamAuth) =>
  send("POST", ["api", "experiments", draftId, "draft", "pids", "doi"], doiResponseSchema, auth, { retry: false });

// TODO(backend): E-D8 path unconfirmed; raw Response for streaming
const getDraftPreview = (draftId: string, auth: UpstreamAuth) =>
  requestRaw("mdrepo", "GET", ["api", "experiments", draftId, "draft", "preview"], withAuth(auth, { headers: { Accept: "image/*" } }));

type ListMineQuery = {
  status?: string;
  q?: string;
  sort?: string;
  page?: number;
  size?: number;
  created_from?: string;
  created_to?: string;
  access?: readonly string[];
  community?: readonly string[];
  structure?: readonly string[];
  engine?: readonly string[];
  author?: readonly string[];
  funder?: readonly string[];
  keyword?: readonly string[];
};

// TODO(backend): E-L1 path unconfirmed
const listMine = (query: ListMineQuery, auth: UpstreamAuth) => get(["api", "me", "experiments"], listMineSchema, auth, { query });

// TODO(backend): E-L1 facet typeahead, path unconfirmed
const listMineFacet = (name: string, query: { q?: string; size?: number }, auth: UpstreamAuth) =>
  get(["api", "me", "experiments", "facets", name], facetBucketsSchema, auth, { query });

// TODO(backend): E-S1 path unconfirmed
const searchStructures = (query: { q: string; source?: string; size?: number }, auth?: UpstreamAuth) =>
  get(["api", "structures", "search"], structureSearchSchema, auth, { query });

// TODO(backend): E-S2 path unconfirmed
const lookupResidue = (code: string, auth?: UpstreamAuth) => get(["api", "residues", code], residueSchema, auth);

// TODO(backend): E-S3 path unconfirmed
const suggestKeywords = (query: { q: string; size?: number }, auth?: UpstreamAuth) =>
  get(["api", "keywords"], keywordsSchema, auth, { query });

// TODO(backend): E-S4 path unconfirmed (backend proxy vs public ORCID API is an open question)
const verifyOrcid = (orcid: string, auth?: UpstreamAuth) => get(["api", "orcid", orcid], orcidSchema, auth);

// TODO(backend): E-S4 path unconfirmed
const searchOrganisations = (query: { q: string; size?: number }, auth?: UpstreamAuth) =>
  get(["api", "organisations"], organisationsSchema, auth, { query });

export {
  commitDraftFile,
  createCommunity,
  createDraft,
  deleteCommunity,
  deleteDraft,
  deleteDraftFile,
  getCommunity,
  getCommunityLogo,
  getDraftPreview,
  getMe,
  initDraftFile,
  listCommunities,
  listMine,
  listMineFacet,
  lookupResidue,
  parseDraftFile,
  publishDraft,
  putDraftFileContent,
  readDraft,
  renameCommunity,
  reserveDoi,
  saveDraft,
  searchOrganisations,
  searchStructures,
  suggestKeywords,
  updateCommunity,
  uploadCommunityLogo,
  verifyOrcid,
};
export type { ListMineQuery };
