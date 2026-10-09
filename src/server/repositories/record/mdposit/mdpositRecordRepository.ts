import "server-only";
import { MDPOSIT_CAPABILITIES, type RecordFacetName, type RecordFacetOption, type RecordSearchQuery } from "@/entities/record";
import { getProject, getProjectOptions, getProjectsSummary, listProjects } from "../../../backends/mdposit/client";
import { optionsSchema, projectSchema, projectsEnvelopeSchema, summarySchema } from "../../../backends/mdposit/projectSchemas";
import { ApiError, isApiError } from "../../../http/errors";
import { logger } from "../../../lib/logger";
import { createTtlCache } from "../../../lib/ttlCache";
import type { RecordRepository } from "../types";
import { toDetail, toFacetOptions, toSummary } from "./mapper";
import { buildOptionsRequest, buildProjectsRequest } from "./queryBuilder";

// Anonymous public reads of MDposit /projects (no session, no token). Contract: docs/mdposit-contract.md.
// Text search and filters combine as an intersection on the live API, so both are sent in one call (mode "combined").

const LIST_TIMEOUT_MS = 8_000;
const OPTIONS_TIMEOUT_MS = 5_000;
const DETAIL_TIMEOUT_MS = 10_000;
const OPTIONS_TTL_MS = 10 * 60_000;

// Facet options and the repository total change rarely and cost one call each; the cache is bounded and keyed by the wire request.
const wireCache = createTtlCache<unknown>(500);

const cached = async <T>(key: string, load: () => Promise<T>): Promise<T> => {
  const hit = wireCache.get(key);
  if (hit !== undefined) return hit as T;
  const value = await load();
  wireCache.set(key, value, OPTIONS_TTL_MS);
  return value;
};

const schemaError = (): ApiError => new ApiError({ kind: "schema", backend: "mdposit" });

const loadFacetOptions = async (facet: RecordFacetName, query: RecordSearchQuery, withCounts: boolean): Promise<RecordFacetOption[]> => {
  const request = buildOptionsRequest(facet, query.facets);
  if (request === null) return [];
  const data = await cached(`options:${request.projection}:${request.query ?? ""}`, async () => {
    const parsed = optionsSchema.safeParse(await getProjectOptions(request, OPTIONS_TIMEOUT_MS));
    if (!parsed.success) throw schemaError();
    return parsed.data;
  });
  const options = toFacetOptions(facet, data);
  // The options call has no `search` parameter: while text is searched the values are offered but the counts would lie.
  return withCounts ? options : options.map((option) => ({ ...option, count: null }));
};

// null = the options could not be loaded (partial state, results are unaffected).
const loadAllOptions = async (query: RecordSearchQuery, withCounts: boolean): Promise<Partial<Record<RecordFacetName, RecordFacetOption[]>> | null> => {
  const facets = MDPOSIT_CAPABILITIES.facets.filter((spec) => spec.kind === "checklist");
  try {
    const lists = await Promise.all(facets.map((spec) => loadFacetOptions(spec.name, query, withCounts)));
    return Object.fromEntries(facets.map((spec, index) => [spec.name, lists[index]]));
  } catch (error) {
    logger.warn("mdposit facet options unavailable", { kind: isApiError(error) ? error.kind : "unknown" });
    return null;
  }
};

const loadRepositoryTotal = async (): Promise<number | null> => {
  try {
    return await cached("summary", async () => {
      const parsed = summarySchema.safeParse(await getProjectsSummary(OPTIONS_TIMEOUT_MS));
      if (!parsed.success) throw schemaError();
      return parsed.data.projectsCount;
    });
  } catch {
    return null;
  }
};

const mdpositRecordRepository: RecordRepository = {
  capabilities: MDPOSIT_CAPABILITIES,

  search: async (query) => {
    const { request, dropped } = buildProjectsRequest(query);
    if (dropped > 0) logger.warn("mdposit filter too large, extra filters dropped", { dropped });
    const searching = request.search !== undefined;

    const [listed, options, repositoryTotal] = await Promise.all([
      listProjects(request, LIST_TIMEOUT_MS),
      loadAllOptions(query, !searching),
      loadRepositoryTotal(),
    ]);
    const envelope = projectsEnvelopeSchema.safeParse(listed);
    if (!envelope.success) throw schemaError();

    const items = envelope.data.projects.flatMap((raw) => {
      const project = projectSchema.safeParse(raw);
      if (project.success) return [toSummary(project.data)];
      // One bad record must not blank the page.
      logger.warn("mdposit project skipped, schema mismatch", { issues: project.error.issues.length });
      return [];
    });
    return {
      total: envelope.data.filteredCount,
      page: request.page,
      size: request.limit,
      items,
      facets: options ?? {},
      repositoryTotal,
      facetsAvailable: options !== null,
    };
  },

  get: async (id) => {
    try {
      const parsed = projectSchema.safeParse(await getProject(id, DETAIL_TIMEOUT_MS));
      if (!parsed.success) throw schemaError();
      return toDetail(parsed.data);
    } catch (error) {
      if (isApiError(error) && error.kind === "not_found") return null;
      throw error;
    }
  },
};

export { mdpositRecordRepository };
