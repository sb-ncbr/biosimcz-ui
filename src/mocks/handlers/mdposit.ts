import { HttpResponse, http, type HttpHandler } from "msw";
import { analysisNames, pdbText, projects, thumbnailPng } from "../fixtures";
import { analysisFixture, analysisOptionsFixture, replicaFixture } from "../fixtures/mdposit";
import { matches, UnsupportedFilter, valuesAt } from "./mongoLite";

const notFound = () => HttpResponse.json({ status: 404, code: "not_found" }, { status: 404 });

const REPLICA_FIXTURE_ACCESSION = "MD-A007L3";

const replicaFixtureMds = (replicaFixture["mds"] as string[]).length;

const findProject = (id: string) => projects.find((p) => p.accession === id.split(".")[0] || p.identifier === id.split(".")[0]);

// The captured live replica is addressable as "MD-A007L3" or "MD-A007L3.<n>" next to the sanitized records.
const isFixtureId = (id: string): boolean => id.split(".")[0] === REPLICA_FIXTURE_ACCESSION;

const knownId = (id: string): boolean => isFixtureId(id) || findProject(id) !== undefined;

// "<accession>.<n>" selects replica n (1-based); the mock records name theirs "replica 1", the live API "replica_1". Sanitized records keep accepting any n (older tests rely on it).
const replicaIndex = (id: string, count: number): number | null | undefined => {
  const suffix = id.split(".")[1];
  if (suffix === undefined) return undefined;
  const n = Number(suffix);
  return Number.isInteger(n) && n >= 1 && n <= count ? n - 1 : null;
};

// The live API rejects 0-based ranges with this exact text (HTTP 400, JSON string body).
const ZERO_BASED_MESSAGE = "Ranges are 1-based so 0 is not supported";

const hasZeroBasedRange = (frames: string): boolean =>
  frames.split(",").some((range) => range.split(/[-:]/).slice(0, 2).some((part) => part.trim() !== "" && Number(part) === 0));

const bad = (message: string) => HttpResponse.json(message, { status: 400 });

const MAX_LIMIT = 100;

type Project = (typeof projects)[number];

// Same contract as the live API (docs/mdposit-contract.md): `search` and `query` intersect, `limit` clamps to 100.
const filterProjects = (params: URLSearchParams): Project[] | Response => {
  const search = params.get("search")?.trim().toLowerCase() ?? "";
  let hits = projects.filter((p) =>
    search === "" ? true : [p.metadata.NAME, p.metadata.DESCRIPTION, p.accession, ...p.metadata.AUTHORS, ...p.metadata.GROUPS].join(" | ").toLowerCase().includes(search),
  );
  const query = params.get("query");
  if (query !== null) {
    try {
      const filter: unknown = JSON.parse(query);
      hits = hits.filter((project) => matches(project, filter));
    } catch (error) {
      return bad(error instanceof UnsupportedFilter ? `Wrong query syntax: ${error.message}` : `Wrong query syntax: ${query}`);
    }
  }
  return hits;
};

const sortProjects = (hits: Project[], sortParam: string | null): Project[] | Response => {
  if (sortParam === null) return hits;
  let sort: unknown;
  try {
    sort = JSON.parse(sortParam);
  } catch {
    return bad("Wrong sort syntax");
  }
  const entries = typeof sort === "object" && sort !== null ? Object.entries(sort) : [];
  const [key, direction] = entries[0] ?? [];
  if (entries.length !== 1 || (direction !== 1 && direction !== -1)) return bad("Wrong sort syntax");
  if (key === "_id") return [...hits].sort((a, b) => direction * a.identifier.localeCompare(b.identifier));
  if (key === "metadata.NAME") return [...hits].sort((a, b) => direction * a.metadata.NAME.localeCompare(b.metadata.NAME));
  return bad(`Unsupported sort ${String(key)}`);
};

// MDposit endpoints #1-#6 and S1-S4. Shapes follow docs/mdposit-contract.md (observed on the live API).
const mdpositHandlers = (): HttpHandler[] => [
  // S2 (before the :id route so "options" is not read as an id). One `projection` field per call, like the live API.
  http.get("*/api/rest/v1/projects/options", ({ request }) => {
    const params = new URL(request.url).searchParams;
    const projection = params.get("projection");
    if (!projection) return bad("Missing projection");
    const hits = filterProjects(params);
    if (hits instanceof Response) return hits;
    const counts: Record<string, number> = {};
    for (const project of hits) {
      const values = valuesAt(project, projection);
      for (const key of values.length === 0 ? ["null"] : values.map(String)) counts[key] = (counts[key] ?? 0) + 1;
    }
    return HttpResponse.json({ [projection]: counts });
  }),
  // S5 (before :id)
  http.get("*/api/rest/v1/projects/summary", () =>
    HttpResponse.json({ projectsCount: projects.length, mdCount: projects.length, totalTime: "0", totalFrames: 0, totalFiles: 0, totalAnalyses: 0 }),
  ),
  // #1
  http.get("*/api/rest/v1/projects", ({ request }) => {
    const params = new URL(request.url).searchParams;
    const filtered = filterProjects(params);
    if (filtered instanceof Response) return filtered;
    const sorted = sortProjects(filtered, params.get("sort"));
    if (sorted instanceof Response) return sorted;
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(params.get("limit") ?? 10) || 10));
    const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
    return HttpResponse.json({ filteredCount: sorted.length, totalMdsCount: null, projects: sorted.slice((page - 1) * limit, page * limit) });
  }),
  // S1
  http.get("*/api/rest/v1/projects/:id/analyses", ({ params }) => (knownId(String(params["id"])) ? HttpResponse.json(analysisNames) : notFound())),
  // #3 and #3b: bare base names return the options list, numbered names and `interactions` return data, uncaptured names 404 like the live API.
  http.get("*/api/rest/v1/projects/:id/analyses/:name", ({ params }) => {
    if (!knownId(String(params["id"]))) return notFound();
    const name = String(params["name"]);
    const options = analysisOptionsFixture(name);
    if (options !== undefined) return HttpResponse.json(options);
    const data = analysisFixture(name);
    return data === undefined ? notFound() : HttpResponse.json(data);
  }),
  // #4: the optional `selection` is accepted and ignored, the single-atom PDB is the same for any selection.
  http.get("*/api/rest/v1/projects/:id/structure", ({ params }) =>
    knownId(String(params["id"])) ? new HttpResponse(pdbText, { headers: { "Content-Type": "chemical/x-pdb" } }) : notFound(),
  ),
  // #5
  http.get("*/api/rest/v1/projects/:id/trajectory", ({ params, request }) => {
    if (!knownId(String(params["id"]))) return notFound();
    const frames = new URL(request.url).searchParams.get("frames");
    if (frames !== null && hasZeroBasedRange(frames)) return bad(ZERO_BASED_MESSAGE);
    return new HttpResponse(new Uint8Array([1, 2, 3, 4]), { headers: { "Content-Type": "application/octet-stream" } });
  }),
  // #6
  http.get("*/api/rest/v1/projects/:id/files/:filename", ({ params }) =>
    findProject(String(params["id"])) ? new HttpResponse(thumbnailPng, { headers: { "Content-Type": "image/png" } }) : notFound(),
  ),
  // S4
  http.get("*/api/rest/v1/projects/:id/topology", ({ params }) =>
    findProject(String(params["id"])) ? HttpResponse.json({ atoms: 1 }) : notFound(),
  ),
  http.get("*/api/rest/v1/projects/:id/references", ({ params }) =>
    findProject(String(params["id"])) ? HttpResponse.json([]) : notFound(),
  ),
  // #2
  http.get("*/api/rest/v1/projects/:id", ({ params }) => {
    const id = String(params["id"]);
    if (isFixtureId(id)) {
      const index = replicaIndex(id, replicaFixtureMds);
      return index === null ? notFound() : HttpResponse.json({ ...replicaFixture, mdIndex: index ?? 0, mdNumber: (index ?? 0) + 1 });
    }
    const project = findProject(id);
    if (!project) return notFound();
    const index = replicaIndex(id, Number.POSITIVE_INFINITY);
    return index === null ? notFound() : HttpResponse.json(index === undefined ? project : { ...project, mdIndex: index, mdNumber: index + 1 });
  }),
  // S3
  http.get("*/api/rest/v1/references/pdbs/:pdbId", ({ params }) =>
    HttpResponse.json({ id: String(params["pdbId"]).toUpperCase(), title: "Lysozyme" }),
  ),
];

export { mdpositHandlers };
