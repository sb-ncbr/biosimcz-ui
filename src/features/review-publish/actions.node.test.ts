import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockBackend, type MockBackend } from "@/mocks/handlers";
import { completeDraft } from "@/test/depositionFixtures";
import { createMemoryJar, signInJar, type MemoryJar } from "@/test/memoryJar";
import { server } from "@/test/msw";
import { setTestEnv } from "@/test/serverEnv";
import { toExperimentMetadata } from "@/server/repositories/deposition";
import { publishDraft } from "./actions";

const held = vi.hoisted(() => ({ jar: undefined as unknown, origin: "http://localhost:3000" as string | null, revalidated: [] as string[] }));

// next/headers and the cookie store have no request scope in tests.
vi.mock("next/headers", () => ({
  headers: async () => new Headers(held.origin === null ? {} : { origin: held.origin }),
}));
vi.mock("next/cache", () => ({ revalidatePath: (path: string) => held.revalidated.push(path) }));
vi.mock("@/server/session/nextJar", () => ({ nextCookieJar: async () => held.jar }));

let backend: MockBackend;
let jar: MemoryJar;

// The backend holds what autosave saved; the action must read it from there, never from the browser.
const store = (draft = completeDraft()) => {
  const stored = backend.state.drafts.get("draft-figma");
  if (!stored) throw new Error("fixture draft missing");
  stored.metadata = toExperimentMetadata(draft) as Record<string, unknown>;
  return stored;
};

beforeEach(async () => {
  setTestEnv();
  backend = createMockBackend();
  server.use(...backend.handlers);
  jar = createMemoryJar();
  held.jar = jar;
  held.origin = "http://localhost:3000";
  held.revalidated = [];
  await signInJar(jar, backend.state);
});

describe("publishDraft", () => {
  it("re-validates the stored draft, publishes it and refreshes the list", async () => {
    store();
    const result = await publishDraft("draft-figma");
    expect(result).toEqual({ ok: true, value: { status: "published", doi: "10.1234/mdrepo.draft-figma", recordUrl: null } });
    expect(backend.state.drafts.get("draft-figma")?.status).toBe("published");
    expect(held.revalidated).toEqual(["/depositions"]);
  });

  it("keeps only https URLs and same-origin paths from the backend record URL", async () => {
    const cases: [string | null, string | null][] = [
      ["https://repo.example/records/1", "https://repo.example/records/1"],
      ["/records/1", "/records/1"],
      ["javascript:alert(1)", null],
      ["data:text/html,x", null],
      ["http://repo.example/records/1", null],
      ["//evil.example/x", null],
      [String.raw`/\evil.example`, null],
      ["not a url", null],
      [null, null],
    ];
    for (const [recordUrl, expected] of cases) {
      store();
      server.use(
        http.post("*/api/experiments/:id/draft/actions/publish", () =>
          HttpResponse.json({ id: "draft-figma", status: "published", record_url: recordUrl, doi: null, published_at: new Date().toISOString() }),
        ),
      );
      const result = await publishDraft("draft-figma");
      expect(result.ok && result.value.recordUrl, String(recordUrl)).toBe(expected);
    }
  });

  it("refuses an incomplete draft with the rows to fix, and never calls the backend", async () => {
    const incomplete = completeDraft();
    incomplete.study.title = "";
    incomplete.runs = [];
    store(incomplete);
    const result = await publishDraft("draft-figma");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("validation");
    expect(result.error.problems?.map((ref) => ref.label)).toEqual(["Title", "At least one run"]);
    expect(result.error.fieldErrors).toMatchObject({ "study.title": "errors.field.required" });
    expect(backend.state.drafts.get("draft-figma")?.status).toBe("draft");
    expect(held.revalidated).toEqual([]);
  });

  it("refuses format errors", async () => {
    const bad = completeDraft();
    bad.study.embargo = { until: "2001-01-01" };
    bad.study.access = "embargoed";
    store(bad);
    const result = await publishDraft("draft-figma");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.problems?.[0]).toMatchObject({ kind: "format", code: "date_not_future" });
  });

  it("checks the origin first", async () => {
    store();
    held.origin = "http://evil.example";
    expect(await publishDraft("draft-figma")).toMatchObject({ ok: false, error: { kind: "forbidden", code: "csrf" } });
    held.origin = null;
    expect(await publishDraft("draft-figma")).toMatchObject({ ok: false, error: { kind: "forbidden" } });
    expect(backend.state.drafts.get("draft-figma")?.status).toBe("draft");
  });

  it("needs a session", async () => {
    store();
    jar.store.clear();
    expect(await publishDraft("draft-figma")).toMatchObject({ ok: false, error: { kind: "auth" } });
  });

  it("rejects malformed ids before any backend call and answers 404 for unknown drafts", async () => {
    for (const id of ["..", "a/b", "-x", "a b", "x".repeat(80)]) {
      expect(await publishDraft(id), id).toMatchObject({ ok: false, error: { kind: "not_found" } });
    }
    expect(await publishDraft("draft-unknown")).toMatchObject({ ok: false, error: { kind: "not_found" } });
  });

  it("does not publish twice", async () => {
    store();
    expect((await publishDraft("draft-figma")).ok).toBe(true);
    expect(await publishDraft("draft-figma")).toMatchObject({ ok: false, error: { kind: "conflict", code: "not_editable" } });
  });

  it("maps a backend failure to a data result without leaking upstream text", async () => {
    store();
    backend.state.drafts.get("draft-figma")?.files.push({ key: "md.tpr", size: 1, status: "pending" });
    const result = await publishDraft("draft-figma");
    expect(result).toMatchObject({ ok: false, error: { kind: "conflict", messageKey: expect.stringMatching(/^errors\./) } });
    expect(JSON.stringify(result)).not.toContain("Files still pending");
  });
});
