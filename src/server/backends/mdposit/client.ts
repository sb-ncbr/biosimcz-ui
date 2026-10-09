import "server-only";
import createClient from "openapi-fetch";
import { getEnv } from "../../config/env";
import { fromResponseBody } from "../../http/errors";
import { requestRaw, resilientFetch } from "../../http/request";
import type { paths } from "./generated/schema";
import { fetchFollowingOneRedirect } from "./redirects";

// openapi-fetch hands over a Request; timeout, retry and transport errors go through the shared core. Without timeoutMs the
// shared default (BACKEND_TIMEOUT_MS) applies.
const fetchViaCore =
  (timeoutMs?: number) =>
  (req: Request): Promise<Response> =>
    resilientFetch("mdposit", req.method, req.url, { headers: req.headers }, timeoutMs === undefined ? {} : { timeoutMs });

const client = (timeoutMs?: number) => createClient<paths>({ baseUrl: getEnv().mdpositBaseUrl, fetch: fetchViaCore(timeoutMs) });

const TRAJECTORY_TIMEOUT_MS = 15 * 60_000;

type AnalysisName = paths["/projects/{projectAccessionOrID}/analyses/{analysisName}"]["get"]["parameters"]["path"]["analysisName"];

type Outcome<T> = { data?: T; error?: unknown; response: Response };

const unwrap = <T>({ data, error, response }: Outcome<T>): T => {
  if (!response.ok || data === undefined) throw fromResponseBody("mdposit", response.status, error);
  return data;
};

type ProjectsQuery = { search?: string; query?: string; page?: number; limit?: number; sort?: Record<string, 1 | -1> };

// #1. `sort` is not in the spec (API-18) but the server honours it; it is sent as stringified JSON like the old UI did.
const listProjects = async (params: ProjectsQuery = {}, timeoutMs?: number) => {
  const { sort, ...rest } = params;
  const query = { ...rest, ...(sort && { sort: JSON.stringify(sort) }) } as Record<string, string | number>;
  return unwrap(await client(timeoutMs).GET("/projects", { params: { query } }));
};

// #2 (accession, id or accession.N)
const getProject = async (idOrAccession: string, timeoutMs?: number) =>
  unwrap(await client(timeoutMs).GET("/projects/{projectAccessionOrID}", { params: { path: { projectAccessionOrID: idOrAccession } } }));

// S1
const listAnalyses = async (idOrAccession: string) =>
  unwrap(
    await client().GET("/projects/{projectAccessionOrID}/analyses", {
      params: { path: { projectAccessionOrID: idOrAccession } },
    }),
  );

// #3 and #3b: same URL, the caller decides whether `name` is a variant or a base name.
const getAnalysis = async (idOrAccession: string, name: string) =>
  unwrap(
    await client().GET("/projects/{projectAccessionOrID}/analyses/{analysisName}", {
      params: { path: { projectAccessionOrID: idOrAccession, analysisName: name as AnalysisName } },
    }),
  );

// S2. The live server needs exactly one `projection` field per call (docs/mdposit-contract.md).
type ProjectOptionsQuery = { query?: string; projection?: string };
const getProjectOptions = async (params: ProjectOptionsQuery = {}, timeoutMs?: number) =>
  unwrap(await client(timeoutMs).GET("/projects/options", { params: { query: params } }));

// Totals of the whole repository (`projectsCount`).
const getProjectsSummary = async (timeoutMs?: number) => unwrap(await client(timeoutMs).GET("/projects/summary"));

// S3
const getPdbReference = async (pdbId: string) =>
  unwrap(await client().GET("/references/pdbs/{PDBID}", { params: { path: { PDBID: pdbId } } }));

// S4
const getTopology = async (idOrAccession: string) =>
  unwrap(
    await client().GET("/projects/{projectAccessionOrID}/topology", {
      params: { path: { projectAccessionOrID: idOrAccession } },
    }),
  );

const getReferences = async (idOrAccession: string) =>
  unwrap(
    await client().GET("/projects/{projectAccessionOrID}/references", {
      params: { path: { projectAccessionOrID: idOrAccession } },
    }),
  );

// Binary endpoints return the unconsumed Response so route handlers can stream them.

// #4
const getStructure = (idOrAccession: string, selection?: string) =>
  requestRaw("mdposit", "GET", ["projects", idOrAccession, "structure"], {
    query: { selection },
    headers: { Accept: "chemical/x-pdb, text/plain" },
  });

// #5
const getTrajectory = (instanceId: string, query: { format?: string; frames?: string; selection?: string }) =>
  requestRaw("mdposit", "GET", ["projects", instanceId, "trajectory"], {
    query,
    headers: { Accept: "application/octet-stream" },
    timeoutMs: null,
  });

// #6 and #4 as streams for the BFF. The live API answers 302 to a sibling host, see redirects.ts.
const getScreenshot = (accession: string, timeoutMs?: number): Promise<Response> =>
  fetchFollowingOneRedirect(["projects", accession, "files", "screenshot.jpg"], {
    headers: { Accept: "image/*" },
    ...(timeoutMs !== undefined && { timeoutMs }),
  });

const openStructure = (accession: string, selection?: string, timeoutMs?: number): Promise<Response> =>
  fetchFollowingOneRedirect(["projects", accession, "structure"], {
    query: { selection },
    headers: { Accept: "chemical/x-pdb, text/plain" },
    retry: false,
    ...(timeoutMs !== undefined && { timeoutMs }),
  });

// #3 as a stream: the body is relayed, not parsed. No retry: a stream call must not multiply upstream load.
const openAnalysis = (instanceId: string, name: string, signal?: AbortSignal, timeoutMs?: number): Promise<Response> =>
  fetchFollowingOneRedirect(["projects", instanceId, "analyses", name], {
    headers: { Accept: "application/json" },
    retry: false,
    ...(signal && { signal }),
    ...(timeoutMs !== undefined && { timeoutMs }),
  });

// #5 as a stream. The deadline also covers the body transfer (fetch keeps the signal), so it is the hard cap on one download.
const openTrajectory = (instanceId: string, query: { format: string; frames?: string; selection?: string }, signal: AbortSignal): Promise<Response> =>
  fetchFollowingOneRedirect(["projects", instanceId, "trajectory"], {
    query,
    headers: { Accept: "application/octet-stream" },
    timeoutMs: TRAJECTORY_TIMEOUT_MS,
    retry: false,
    signal,
  });

export {
  getAnalysis,
  getPdbReference,
  getProject,
  getProjectOptions,
  getProjectsSummary,
  getReferences,
  getScreenshot,
  getStructure,
  getTopology,
  getTrajectory,
  listAnalyses,
  listProjects,
  openAnalysis,
  openStructure,
  openTrajectory,
  TRAJECTORY_TIMEOUT_MS,
};
export type { ProjectOptionsQuery, ProjectsQuery };
