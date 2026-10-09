import { HttpResponse, http, type HttpHandler } from "msw";
import { logoSvg } from "../fixtures";
import { authorize, problem } from "./auth";
import { nextId, type Draft, type MockState } from "./state";

// KNOWN MDRepo endpoints #9-#19. Shapes follow the old UI's usage; unknown bits are marked in the client.
const mdrepoHandlers = (state: MockState): HttpHandler[] => {
  const guard = (request: Request, write = false) => authorize(state, request, write);
  // Consumes one simulated failure for this file and stage, if any (see UploadFault in state.ts).
  const uploadFault = (key: string, stage: "init" | "content" | "commit") => {
    const fault = state.uploadFaults.get(key);
    if (!fault || fault.stage !== stage || fault.remaining <= 0) return null;
    fault.remaining -= 1;
    return problem(fault.status, "simulated_failure", "Simulated upload failure");
  };
  const findCommunity = (idOrSlug: string) => state.communities.find((c) => c.id === idOrSlug || c.slug === idOrSlug);

  return [
    // #9
    http.get("*/api/communities", ({ request }) => {
      const q = new URL(request.url).searchParams.get("q")?.toLowerCase() ?? "";
      const hits = state.communities.filter((c) => c.metadata.title.toLowerCase().includes(q));
      return HttpResponse.json({ hits: { hits, total: hits.length } });
    }),
    // #10
    http.get("*/api/communities/:id", ({ params }) => {
      const found = findCommunity(String(params["id"]));
      return found ? HttpResponse.json(found) : problem(404, "not_found", "Community not found");
    }),
    // #11
    http.post("*/api/communities", async ({ request }) => {
      const denied = guard(request, true);
      if (denied) return denied;
      const body = (await request.json()) as { slug: string; metadata: { title: string; description?: string } };
      const created = { id: nextId(state, "community"), access: { visibility: "public" }, ...body, metadata: { description: "", ...body.metadata } };
      state.communities.push(created);
      return HttpResponse.json(created, { status: 201 });
    }),
    // #12
    http.put("*/api/communities/:id", async ({ request, params }) => {
      const denied = guard(request, true);
      if (denied) return denied;
      const found = findCommunity(String(params["id"]));
      if (!found) return problem(404, "not_found", "Community not found");
      Object.assign(found, await request.json());
      return HttpResponse.json(found);
    }),
    // #13
    http.delete("*/api/communities/:id", ({ request, params }) => {
      const denied = guard(request, true);
      if (denied) return denied;
      const found = findCommunity(String(params["id"]));
      if (!found) return problem(404, "not_found", "Community not found");
      state.communities.splice(state.communities.indexOf(found), 1);
      return new HttpResponse(null, { status: 204 });
    }),
    // #14
    http.post("*/api/communities/:id/rename", async ({ request, params }) => {
      const denied = guard(request, true);
      if (denied) return denied;
      const found = findCommunity(String(params["id"]));
      if (!found) return problem(404, "not_found", "Community not found");
      found.slug = ((await request.json()) as { slug: string }).slug;
      return HttpResponse.json(found);
    }),
    // #15
    http.get("*/api/communities/:id/logo", ({ params }) =>
      findCommunity(String(params["id"]))
        ? new HttpResponse(logoSvg, { headers: { "Content-Type": "image/svg+xml" } })
        : problem(404, "not_found", "No logo"),
    ),
    // logo upload
    http.post("*/api/communities/:id/logo", ({ request }) => guard(request, true) ?? new HttpResponse(null, { status: 204 })),

    // #16 (empty draft accepted, U2)
    http.post("*/api/experiments/", ({ request }) => {
      const denied = guard(request, true);
      if (denied) return denied;
      const now = new Date().toISOString();
      const draft: Draft = { id: nextId(state, "draft"), status: "draft", revision: 1, created_at: now, updated_at: now, metadata: {}, files: [] };
      state.drafts.set(draft.id, draft);
      return HttpResponse.json({ id: draft.id }, { status: 201 });
    }),
    // #17
    http.post("*/api/experiments/:id/draft/files", async ({ request, params }) => {
      const denied = guard(request, true);
      if (denied) return denied;
      const draft = state.drafts.get(String(params["id"]));
      if (!draft) return problem(404, "not_found", "Draft not found");
      const items = (await request.json()) as { key: string }[];
      for (const { key } of items) {
        const fault = uploadFault(key, "init");
        if (fault) return fault;
        if (key.includes(".fail-once.") && !state.uploadFaults.has(key)) state.uploadFaults.set(key, { stage: "content", status: 500, remaining: 1 });
        if (key.includes(".fail-always.") && !state.uploadFaults.has(key)) state.uploadFaults.set(key, { stage: "content", status: 500, remaining: Infinity });
        if (!draft.files.some((f) => f.key === key)) draft.files.push({ key, size: 0, status: "pending" });
      }
      return HttpResponse.json(items, { status: 201 });
    }),
    // #18
    http.put("*/api/experiments/:id/draft/files/:key/content", async ({ request, params }) => {
      const denied = guard(request, true);
      if (denied) return denied;
      const draft = state.drafts.get(String(params["id"]));
      const file = draft?.files.find((f) => f.key === decodeURIComponent(String(params["key"])));
      if (!file) return problem(404, "not_found", "File not initialised");
      const fault = uploadFault(file.key, "content");
      if (fault) return fault;
      file.size = (await request.arrayBuffer()).byteLength;
      return HttpResponse.json({ key: file.key, size: file.size });
    }),
    // #19
    http.post("*/api/experiments/:id/draft/files/:key/commit", ({ request, params }) => {
      const denied = guard(request, true);
      if (denied) return denied;
      const draft = state.drafts.get(String(params["id"]));
      const file = draft?.files.find((f) => f.key === decodeURIComponent(String(params["key"])));
      if (!file) return problem(404, "not_found", "File not initialised");
      const fault = uploadFault(file.key, "commit");
      if (fault) return fault;
      file.status = "completed";
      return HttpResponse.json({ key: file.key, size: file.size, status: "completed" });
    }),
  ];
};

export { mdrepoHandlers };
