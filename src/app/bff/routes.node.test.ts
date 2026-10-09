import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockBackend } from "@/mocks/handlers";
import { createMemoryJar, signInJar, type MemoryJar } from "@/test/memoryJar";
import { server } from "@/test/msw";
import { setTestEnv } from "@/test/serverEnv";

const held = vi.hoisted(() => ({ jar: undefined as unknown }));

vi.mock("@/server/session/nextJar", () => ({ nextCookieJar: async () => held.jar }));

const ORIGIN = "http://localhost:3000";
const WRITE_METHODS = ["POST", "PUT", "PATCH", "DELETE"] as const;

type Handler = (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response> | Response;

// Every route module under src/app/bff, discovered by glob so a new route cannot skip the check.
// Vite resolves import.meta.glob at transform time; the types are not loaded in this tsconfig.
const modules = (import.meta as unknown as { glob: (pattern: string) => Record<string, () => Promise<Record<string, unknown>>> }).glob("/src/app/bff/**/route.ts");

const call = async (handler: Handler, method: string, headers: Record<string, string>): Promise<Response> =>
  handler(new Request(`${ORIGIN}/bff/x`, { method, headers: { "content-type": "application/json", ...headers }, body: "{}" }), {
    params: Promise.resolve({ draftId: "draft-figma", key: "topol.top" }),
  });

let jar: MemoryJar;

beforeEach(() => {
  setTestEnv();
  const backend = createMockBackend();
  server.use(...backend.handlers);
  jar = createMemoryJar();
  held.jar = jar;
});

describe("BFF write methods", () => {
  it("finds the route modules", () => {
    expect(Object.keys(modules).length).toBeGreaterThan(0);
  });

  for (const [path, load] of Object.entries(modules)) {
    describe(path, () => {
      for (const method of WRITE_METHODS) {
        it(`${method} rejects cross-origin and anonymous requests`, async () => {
          const handler = ((await load())[method] ?? null) as Handler | null;
          if (!handler) return;

          const backend = createMockBackend();
          server.use(...backend.handlers);
          await signInJar(jar, backend.state);
          const crossOrigin = await call(handler, method, { origin: "https://evil.example" });
          expect(crossOrigin.status).toBe(403);
          const noOriginHeaders = await call(handler, method, {});
          expect(noOriginHeaders.status).toBe(403);

          held.jar = createMemoryJar();
          const anonymous = await call(handler, method, { origin: ORIGIN });
          expect(anonymous.status).toBe(401);
        });
      }
    });
  }
});

describe("BFF public GET routes", () => {
  it("serves the record thumbnail without a session and exports no write method", async () => {
    held.jar = createMemoryJar();
    const route = (await modules["/src/app/bff/records/[id]/thumbnail/route.ts"]?.()) as Record<string, unknown> | undefined;
    expect(route).toBeDefined();
    for (const method of WRITE_METHODS) expect(route?.[method]).toBeUndefined();
    const response = await (route?.["GET"] as Handler)(new Request(`${ORIGIN}/bff/x`), { params: Promise.resolve({ id: "MD-A00001" }) });
    expect(response.status).toBe(200);
  });

  it("serves the record structure without a session and exports no write method", async () => {
    held.jar = createMemoryJar();
    const route = (await modules["/src/app/bff/records/[id]/structure/route.ts"]?.()) as Record<string, unknown> | undefined;
    expect(route).toBeDefined();
    for (const method of WRITE_METHODS) expect(route?.[method]).toBeUndefined();
    const response = await (route?.["GET"] as Handler)(new Request(`${ORIGIN}/bff/x`), { params: Promise.resolve({ id: "MD-A00001" }) });
    expect(response.status).toBe(200);
  });
});
