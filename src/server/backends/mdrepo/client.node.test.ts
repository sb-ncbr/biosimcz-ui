import { beforeEach, describe, expect, it } from "vitest";
import { createMockBackend, type MockBackend } from "@/mocks/handlers";
import { TEST_USER } from "@/mocks/fixtures";
import { publishedDepositions } from "@/mocks/fixtures/myDepositions";
import { seedMyDepositionsDemo } from "@/mocks/handlers/myDepositions";
import { server } from "@/test/msw";
import { setTestEnv } from "@/test/serverEnv";
import { mintMockTokens } from "@/mocks/handlers/oidc";
import type { UpstreamAuth } from "../../session/types";
import * as mdrepo from "./client";

let backend: MockBackend;
let auth: UpstreamAuth;

beforeEach(() => {
  setTestEnv();
  backend = createMockBackend();
  server.use(...backend.handlers);
  auth = { headers: { Authorization: `Bearer ${mintMockTokens(backend.state).access}` } };
});

describe("MDRepo client: known endpoints", () => {
  it("sends the bearer header it is given and nothing else", async () => {
    await expect(mdrepo.createDraft(auth)).resolves.toMatchObject({ status: 201 });
    await expect(mdrepo.createDraft({ headers: { Authorization: "Bearer not-issued" } })).rejects.toMatchObject({ kind: "auth" });
  });

  it("#9-#15 community lifecycle", async () => {
    const list = await mdrepo.listCommunities({ q: "biosim" });
    expect(list.data.hits.hits.map((c) => c.slug)).toEqual(["biosim-cz"]);
    expect((await mdrepo.getCommunity("biosim-cz")).data.id).toBe("community-1");
    await expect(mdrepo.getCommunity("missing")).rejects.toMatchObject({ kind: "not_found" });

    const created = await mdrepo.createCommunity(
      { slug: "new-one", metadata: { title: "New one" }, access: { visibility: "public" } },
      auth,
    );
    expect(created.data.slug).toBe("new-one");
    const renamed = await mdrepo.renameCommunity(created.data.id, "renamed", auth);
    expect(renamed.data.slug).toBe("renamed");
    const updated = await mdrepo.updateCommunity("renamed", { metadata: { title: "Changed" } }, auth);
    expect(updated.data.metadata.title).toBe("Changed");
    await mdrepo.deleteCommunity("renamed", auth);
    await expect(mdrepo.getCommunity("renamed")).rejects.toMatchObject({ kind: "not_found" });

    const logo = await mdrepo.getCommunityLogo("biosim-cz");
    expect(logo.headers.get("content-type")).toBe("image/svg+xml");
    await logo.text();
    const form = new FormData();
    form.append("logo", new Blob(["x"]), "l.png");
    await expect(mdrepo.uploadCommunityLogo("biosim-cz", form, auth)).resolves.toBeDefined();
  });

  it("rejects writes with a token the IdP revoked", async () => {
    const [access] = [...backend.state.oidc.accessTokens.keys()];
    backend.state.oidc.accessTokens.get(access!)!.revoked = true;
    await expect(
      mdrepo.createCommunity({ slug: "x", metadata: { title: "x" }, access: { visibility: "public" } }, auth),
    ).rejects.toMatchObject({ kind: "auth" });
  });

  it("#16-#19 empty draft and the three-step upload with awkward keys", async () => {
    const draft = await mdrepo.createDraft(auth);
    const key = "my file #1?.top";
    await mdrepo.initDraftFile(draft.data.id, key, auth);
    const body = new Blob([new Uint8Array(2048)]);
    await mdrepo.putDraftFileContent(draft.data.id, key, body, auth);
    await mdrepo.commitDraftFile(draft.data.id, key, auth);
    const read = await mdrepo.readDraft(draft.data.id, auth);
    expect(read.data.files).toEqual([expect.objectContaining({ key, size: 2048, status: "completed" })]);
  });
});

describe("MDRepo client: PROPOSED endpoints (mock follows backend-feature-requests.md)", () => {
  it("E-P1 current user", async () => {
    expect((await mdrepo.getMe(auth)).data).toMatchObject({ email: TEST_USER.email, display_name: TEST_USER.displayName });
  });

  it("E-D1 read and E-D2 save with revision, 412 on mismatch", async () => {
    const read = await mdrepo.readDraft("draft-figma", auth);
    expect(read.data.revision).toBe(1);
    const saved = await mdrepo.saveDraft("draft-figma", { study: { title: "Changed" } }, 1, auth);
    expect(saved.data.revision).toBe(2);
    await expect(mdrepo.saveDraft("draft-figma", {}, 1, auth)).rejects.toMatchObject({ kind: "conflict", status: 412 });
  });

  it("empty draft saves lenient and publish validates strictly", async () => {
    await mdrepo.saveDraft("draft-empty", {}, 1, auth);
    const error = await mdrepo.publishDraft("draft-empty", 2, auth).catch((e: unknown) => e);
    expect(error).toMatchObject({ kind: "validation", fieldErrors: { "metadata.study.title": "errors.field.required" } });
    const published = await mdrepo.publishDraft("draft-figma", 1, auth);
    expect(published.data.status).toBe("published");
  });

  it("E-D3 blocks publish while files are pending", async () => {
    await mdrepo.initDraftFile("draft-figma", "a.top", auth);
    await expect(mdrepo.publishDraft("draft-figma", 1, auth)).rejects.toMatchObject({ kind: "conflict", code: "files_pending" });
  });

  it("E-D4 delete, E-D5 delete file, E-D6 parse, E-D7 DOI, E-D8 preview", async () => {
    await mdrepo.initDraftFile("draft-figma", "topol.top", auth);
    await expect(mdrepo.parseDraftFile("draft-figma", "topol.top", auth)).rejects.toMatchObject({ code: "not_committed" });
    await mdrepo.putDraftFileContent("draft-figma", "topol.top", new Blob(["x"]), auth);
    await mdrepo.commitDraftFile("draft-figma", "topol.top", auth);
    const parsed = await mdrepo.parseDraftFile("draft-figma", "topol.top", auth);
    expect(parsed.data).toMatchObject({ status: "ok", detected_role: "topology" });
    await mdrepo.deleteDraftFile("draft-figma", "topol.top", auth);
    await expect(mdrepo.deleteDraftFile("draft-figma", "topol.top", auth)).rejects.toMatchObject({ kind: "not_found" });

    const first = await mdrepo.reserveDoi("draft-figma", auth);
    const second = await mdrepo.reserveDoi("draft-figma", auth);
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.data.doi).toBe(first.data.doi);

    await expect(mdrepo.getDraftPreview("draft-figma", auth)).rejects.toMatchObject({ kind: "not_found" });
    await mdrepo.deleteDraft("draft-empty", auth);
    await expect(mdrepo.readDraft("draft-empty", auth)).rejects.toMatchObject({ kind: "not_found" });
  });

  it("E-L1 list with counts, search and facet typeahead", async () => {
    const all = await mdrepo.listMine({ status: "all" }, auth);
    expect(all.data.counts_by_status["all"]).toBe(2);
    expect(all.data.items.find((i) => i.id === "draft-empty")?.title).toBeNull();
    const searched = await mdrepo.listMine({ q: "lysozyme", access: ["open"] }, auth);
    expect(searched.data.items.map((i) => i.id)).toEqual(["draft-figma"]);
    expect((await mdrepo.listMineFacet("access", { q: "o" }, auth)).data.items).toHaveLength(1);
  });

  it("E-L1 rows come only from mock state; the demo seed adds published rows", async () => {
    seedMyDepositionsDemo(backend.state);
    const all = await mdrepo.listMine({ status: "all" }, auth);
    expect(all.data.counts_by_status["draft"]).toBe(backend.state.drafts.size);
    expect(all.data.counts_by_status["published"]).toBe(publishedDepositions.length);
  });

  it("E-S1..E-S4 search helpers", async () => {
    expect((await mdrepo.searchStructures({ q: "lyso" })).data.items[0]?.id).toBe("1AKI");
    await expect(mdrepo.searchStructures({ q: "l" })).rejects.toMatchObject({ kind: "validation" });
    expect((await mdrepo.lookupResidue("hem")).data.code).toBe("HEM");
    await expect(mdrepo.lookupResidue("ZZZ")).rejects.toMatchObject({ kind: "not_found" });
    expect((await mdrepo.suggestKeywords({ q: "lys" })).data.items[0]?.keyword).toBe("lysozyme");
    expect((await mdrepo.verifyOrcid("0000-0002-1825-0097")).data.verified).toBe(true);
    expect((await mdrepo.searchOrganisations({ q: "masaryk" })).data.items[0]?.ror_id).toContain("ror.org");
  });

  it("requires authentication", async () => {
    server.resetHandlers(...createMockBackend().handlers);
    await expect(mdrepo.getMe({ headers: {} })).rejects.toMatchObject({ kind: "auth" });
    await expect(mdrepo.createDraft({ headers: {} })).rejects.toMatchObject({ kind: "auth" });
  });
});
