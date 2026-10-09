import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockBackend, type MockBackend } from "@/mocks/handlers";
import { completeDraft } from "@/test/depositionFixtures";
import { createMemoryJar, signInJar, type MemoryJar } from "@/test/memoryJar";
import { server } from "@/test/msw";
import { setTestEnv } from "@/test/serverEnv";
import { GET, PUT } from "./route";

const held = vi.hoisted(() => ({ jar: undefined as unknown }));

// next/headers has no request scope in tests; the handler talks to an in-memory jar instead.
vi.mock("@/server/session/nextJar", () => ({ nextCookieJar: async () => held.jar }));

const ORIGIN = "http://localhost:3000";
let backend: MockBackend;
let jar: MemoryJar;

const put = (draftId: string, body: unknown, headers: Record<string, string> = { origin: ORIGIN }) =>
  PUT(
    new Request(`${ORIGIN}/bff/depositions/${draftId}`, {
      method: "PUT",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ draftId }) },
  );

const get = (draftId: string) =>
  GET(new Request(`${ORIGIN}/bff/depositions/${draftId}`), { params: Promise.resolve({ draftId }) });

beforeEach(async () => {
  setTestEnv();
  backend = createMockBackend();
  server.use(...backend.handlers);
  jar = createMemoryJar();
  held.jar = jar;
  await signInJar(jar, backend.state);
});

describe("PUT /bff/depositions/[draftId]", () => {
  it("validates, maps to the metadata shape and saves with the revision", async () => {
    const response = await put("draft-figma", { draft: completeDraft(), revision: 1 });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ revision: 2 });
    const stored = backend.state.drafts.get("draft-figma");
    expect(stored?.revision).toBe(2);
    expect(stored?.metadata).toMatchObject({
      study: { title: "Lysozyme in water", community_ids: ["community-1"] },
      runs: [{ id: "run-production", simulation_type: "molecular_dynamics", length_ns: 100 }],
    });
  });

  it("saves an empty draft (U2)", async () => {
    const response = await put("draft-empty", { draft: {}, revision: 1 });
    expect(response.status).toBe(200);
    expect(backend.state.drafts.get("draft-empty")?.revision).toBe(2);
  });

  it("answers a stale revision with a conflict the client can act on", async () => {
    const response = await put("draft-figma", { draft: {}, revision: 7 });
    expect(response.status).toBe(409);
    expect(response.headers.get("content-type")).toContain("application/problem+json");
    expect(await response.json()).toMatchObject({ kind: "conflict" });
    expect(backend.state.drafts.get("draft-figma")?.revision).toBe(1);
  });

  it("rejects format errors with field errors and never calls the backend", async () => {
    const before = backend.state.drafts.get("draft-figma")?.revision;
    const response = await put("draft-figma", { draft: { study: { doi: "10.12" } }, revision: 1 });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ kind: "validation", fieldErrors: { "study.doi": "errors.field.invalid_doi" } });
    expect(backend.state.drafts.get("draft-figma")?.revision).toBe(before);
  });

  it("checks the origin before anything else", async () => {
    expect((await put("draft-figma", { draft: {}, revision: 1 }, {})).status).toBe(403);
    expect((await put("draft-figma", { draft: {}, revision: 1 }, { origin: "http://evil.example" })).status).toBe(403);
    expect((await put("draft-figma", { draft: {}, revision: 1 }, { "sec-fetch-site": "same-origin" })).status).toBe(200);
  });

  it("returns 404 for malformed draft ids without touching the backend", async () => {
    for (const id of ["..", "a%2Fb", "-x", "a b", "x".repeat(80)]) {
      expect((await put(id, { draft: {}, revision: 1 })).status, id).toBe(404);
    }
  });

  it("returns 404 for an unknown draft and 401 without a session", async () => {
    expect((await put("draft-unknown", { draft: {}, revision: 1 })).status).toBe(404);
    jar.store.clear();
    expect((await put("draft-figma", { draft: {}, revision: 1 })).status).toBe(401);
  });

  it("rejects malformed and oversized bodies", async () => {
    expect((await put("draft-figma", "{nope")).status).toBe(400);
    expect((await put("draft-figma", { draft: {} })).status).toBe(400);
    expect((await put("draft-figma", { draft: {}, revision: -1 })).status).toBe(400);
    expect((await put("draft-figma", "x".repeat(1_048_577))).status).toBe(413);
  });

  it("rejects an oversized Content-Length even when the body itself is small", async () => {
    const response = await put("draft-figma", { draft: {}, revision: 1 }, { origin: ORIGIN, "content-length": "2000000" });
    expect(response.status).toBe(413);
    expect(backend.state.drafts.get("draft-figma")?.revision).toBe(1);
  });

  it("aborts a streamed body that exceeds the limit without Content-Length", async () => {
    let chunksPulled = 0;
    const chunk = new Uint8Array(256 * 1024).fill(120);
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        chunksPulled += 1;
        controller.enqueue(chunk);
      },
    });
    const response = await PUT(
      new Request(`${ORIGIN}/bff/depositions/draft-figma`, {
        method: "PUT",
        headers: { origin: ORIGIN, "content-type": "application/json" },
        body,
        duplex: "half",
      } as RequestInit),
      { params: Promise.resolve({ draftId: "draft-figma" }) },
    );
    expect(response.status).toBe(413);
    // Endless stream: the reader must stop shortly after the 1 MB limit.
    expect(chunksPulled).toBeLessThan(10);
  });
});

describe("GET /bff/depositions/[draftId]", () => {
  it("returns the current server copy for conflict recovery", async () => {
    const response = await get("draft-figma");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: "draft-figma",
      status: "draft",
      revision: 1,
      draft: { study: { title: "Lysozyme in water" } },
      files: [],
    });
  });

  it("404s a malformed id", async () => {
    expect((await get("..")).status).toBe(404);
  });
});
