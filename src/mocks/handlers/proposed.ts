import { HttpResponse, http, type HttpHandler } from "msw";
import { TEST_USER } from "../fixtures";
import { authorize, problem } from "./auth";
import type { Draft, MockState } from "./state";

// Every handler here follows plans/backend-feature-requests.md. Paths are PROPOSED.
// TODO(backend): replace each path with the confirmed one; remove this file once the real backend is available.
const proposedHandlers = (state: MockState): HttpHandler[] => {
  const guard = (request: Request, write = false) => authorize(state, request, write);
  const draftOf = (id: unknown) => state.drafts.get(String(id));
  const keyOf = (params: Record<string, unknown>) => decodeURIComponent(String(params["key"]));

  const draftView = (draft: Draft) => ({
    id: draft.id,
    status: draft.status,
    revision: draft.revision,
    created_at: draft.created_at,
    updated_at: draft.updated_at,
    owner_id: TEST_USER.id,
    metadata: draft.metadata,
    files: draft.files,
    community_ids: [],
    doi: draft.doi ?? null,
  });

  return [
    // E-P1
    http.get("*/api/me", ({ request }) => {
      const denied = guard(request);
      if (denied) return denied;
      return HttpResponse.json({
        id: TEST_USER.id,
        email: TEST_USER.email,
        display_name: TEST_USER.displayName,
        given_name: "Jana",
        family_name: "Novakova",
        orcid: null,
        avatar_url: null,
        roles: TEST_USER.roles,
      });
    }),

    // E-D1
    http.get("*/api/experiments/:id/draft", ({ request, params }) => {
      const denied = guard(request);
      if (denied) return denied;
      const draft = draftOf(params["id"]);
      return draft ? HttpResponse.json(draftView(draft)) : problem(404, "not_found", "Draft not found");
    }),
    // E-D2 (lenient validation, If-Match revision)
    http.put("*/api/experiments/:id/draft", async ({ request, params }) => {
      const denied = guard(request, true);
      if (denied) return denied;
      const draft = draftOf(params["id"]);
      if (!draft) return problem(404, "not_found", "Draft not found");
      if (draft.status !== "draft") return problem(409, "not_editable", "Draft is not editable");
      if (request.headers.get("if-match") !== String(draft.revision)) {
        return problem(412, "revision_mismatch", "Revision mismatch", { current_revision: draft.revision });
      }
      const body = (await request.json()) as { metadata?: Record<string, unknown> };
      draft.metadata = body.metadata ?? {};
      draft.revision += 1;
      draft.updated_at = new Date().toISOString();
      return HttpResponse.json({ id: draft.id, revision: draft.revision, updated_at: draft.updated_at });
    }),
    // E-D3 (strict: title required, all files committed)
    http.post("*/api/experiments/:id/draft/actions/publish", async ({ request, params }) => {
      const denied = guard(request, true);
      if (denied) return denied;
      const draft = draftOf(params["id"]);
      if (!draft) return problem(404, "not_found", "Draft not found");
      if (draft.status !== "draft") return problem(409, "not_editable", "Draft is not editable");
      if (draft.files.some((f) => f.status === "pending")) return problem(409, "files_pending", "Files still pending");
      const study = draft.metadata["study"] as { title?: string } | undefined;
      if (!study?.title) {
        return problem(422, "validation_failed", "Validation failed", {
          errors: [{ field: "metadata.study.title", code: "required", message: "Title is required" }],
        });
      }
      draft.status = "published";
      draft.doi ??= `10.1234/mdrepo.${draft.id}`;
      return HttpResponse.json({ id: draft.id, status: "published", record_url: null, doi: draft.doi ?? null, published_at: new Date().toISOString() });
    }),
    // E-D4
    http.delete("*/api/experiments/:id/draft", ({ request, params }) => {
      const denied = guard(request, true);
      if (denied) return denied;
      const draft = draftOf(params["id"]);
      if (!draft) return problem(404, "not_found", "Draft not found");
      if (draft.status !== "draft") return problem(409, "not_editable", "Not a draft");
      state.drafts.delete(draft.id);
      return new HttpResponse(null, { status: 204 });
    }),
    // E-D5
    http.delete("*/api/experiments/:id/draft/files/:key", ({ request, params }) => {
      const denied = guard(request, true);
      if (denied) return denied;
      const draft = draftOf(params["id"]);
      const index = draft?.files.findIndex((f) => f.key === keyOf(params)) ?? -1;
      if (!draft || index < 0) return problem(404, "not_found", "File not found");
      draft.files.splice(index, 1);
      return new HttpResponse(null, { status: 204 });
    }),
    // E-D6
    http.post("*/api/experiments/:id/draft/files/:key/parse", ({ request, params }) => {
      const denied = guard(request, true);
      if (denied) return denied;
      const file = draftOf(params["id"])?.files.find((f) => f.key === keyOf(params));
      if (!file) return problem(404, "not_found", "File not found");
      if (file.status !== "completed") return problem(409, "not_committed", "File not committed");
      if (file.key.includes(".unreadable.")) return HttpResponse.json({ status: "unreadable", fields: [], warnings: [] });
      if (/\.(top|itp)$/i.test(file.key)) {
        return HttpResponse.json({
          status: "ok",
          detected_role: "topology",
          fields: [
            { path: "system.engine.name", value: "GROMACS" },
            { path: "system.engine.version", value: "2023.1" },
            { path: "system.forceField", value: "CHARMM36m" },
            { path: "system.waterModel", value: "TIP3P" },
            {
              path: "system.molecules",
              value: [
                { type: "protein", name: "Lysozyme C", chains: ["A"], residues: 129 },
                { type: "water", name: "Water", count: 8241, parameters: "TIP3P" },
              ],
            },
          ],
          warnings: [],
        });
      }
      if (/\.gro$/i.test(file.key)) {
        return HttpResponse.json({
          status: "ok",
          detected_role: "structure_and_box",
          fields: [
            { path: "system.systemSize", value: 33940 },
            { path: "system.box.shape", value: "triclinic" },
            { path: "system.box.a", value: 6.82 },
            { path: "system.box.b", value: 7.14 },
            { path: "system.box.c", value: 6.55 },
            { path: "system.box.alpha", value: 90 },
            { path: "system.box.beta", value: 104.2 },
            { path: "system.box.gamma", value: 90 },
          ],
          warnings: [],
        });
      }
      if (/\.pdb$/i.test(file.key)) {
        return HttpResponse.json({
          status: "ok",
          detected_role: "starting_structure",
          fields: [{ path: "system.startingStructure", value: { source: "pdb", id: "1AKI", title: "Lysozyme C" } }],
          warnings: [],
        });
      }
      return HttpResponse.json({ status: "unsupported", fields: [], warnings: [] });
    }),
    // E-D7
    http.post("*/api/experiments/:id/draft/pids/doi", ({ request, params }) => {
      const denied = guard(request, true);
      if (denied) return denied;
      const draft = draftOf(params["id"]);
      if (!draft) return problem(404, "not_found", "Draft not found");
      const created = draft.doi === undefined;
      draft.doi ??= `10.1234/mdrepo.${draft.id}`;
      return HttpResponse.json({ doi: draft.doi, status: "reserved" }, { status: created ? 201 : 200 });
    }),
    // E-D8
    http.get("*/api/experiments/:id/draft/preview", () => problem(404, "not_found", "No preview")),

    // E-L1 lives in ./myDepositions.ts

    // E-S1..E-S4
    http.get("*/api/structures/search", ({ request }) => {
      const q = new URL(request.url).searchParams.get("q") ?? "";
      if (q.length < 2) return problem(400, "bad_request", "Query too short");
      return HttpResponse.json({
        items: [{ source: "pdb", id: "1AKI", title: "Lysozyme", organism: "Gallus gallus", method: "X-ray", resolution_A: 1.5 }],
      });
    }),
    http.get("*/api/residues/:code", ({ params }) =>
      String(params["code"]).toUpperCase() === "HEM"
        ? HttpResponse.json({ code: "HEM", name: "Protoporphyrin IX containing Fe", formula: "C34 H32 Fe N4 O4" })
        : problem(404, "not_found", "Unknown residue"),
    ),
    http.get("*/api/keywords", () => HttpResponse.json({ items: [{ keyword: "lysozyme", count: 12 }] })),
    http.get("*/api/orcid/:id", ({ params }) =>
      HttpResponse.json({ orcid: String(params["id"]), given_name: "Jana", family_name: "Novakova", verified: true }),
    ),
    http.get("*/api/organisations", () =>
      HttpResponse.json({ items: [{ ror_id: "https://ror.org/02j46qs45", name: "Masaryk University", country: "CZ" }] }),
    ),
  ];
};

export { proposedHandlers };
