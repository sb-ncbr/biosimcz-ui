import "server-only";
import { LIST_PAGE_SIZE, type DepositionList, type DepositionListQuery } from "@/entities/deposition";
import {
  createDraft as createDraftRequest,
  deleteDraft as deleteDraftRequest,
  listMine as listMineRequest,
  type ListMineQuery,
} from "../../backends/mdrepo/client";
import type { CookieJar } from "../../session";
import { withUpstream } from "../../session";
import { fromListMineResponse } from "./listMapper";

// Only sends what the user actually chose, so the backend applies its own defaults for the rest.
const toWireQuery = (query: DepositionListQuery, size: number): ListMineQuery => {
  const wire: ListMineQuery = { status: query.status, sort: query.sort, page: query.page, size };
  if (query.q) wire.q = query.q;
  if (query.createdFrom) wire.created_from = query.createdFrom;
  if (query.createdTo) wire.created_to = query.createdTo;
  for (const [name, values] of Object.entries(query.facets)) {
    if (values.length > 0) (wire as Record<string, unknown>)[name] = values;
  }
  return wire;
};

// E-L1. RSC callers pass a read-only jar (no refresh); route handlers pass a writable one.
const listMine = async (jar: CookieJar, query: DepositionListQuery, size: number = LIST_PAGE_SIZE): Promise<DepositionList> => {
  const { data } = await withUpstream(jar, (auth) => listMineRequest(toWireQuery(query, size), auth));
  return fromListMineResponse(data);
};

// #16. An empty draft is accepted (U2); the caller redirects to the wizard.
const createDraft = async (jar: CookieJar): Promise<{ id: string }> => {
  const { data } = await withUpstream(jar, (auth) => createDraftRequest(auth));
  return { id: data.id };
};

// E-D4. The caller has validated the id shape.
const deleteDraft = async (jar: CookieJar, draftId: string): Promise<void> => {
  await withUpstream(jar, (auth) => deleteDraftRequest(draftId, auth));
};

export { createDraft, deleteDraft, listMine, toWireQuery };
