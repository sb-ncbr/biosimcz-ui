import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockBackend } from "@/mocks/handlers";
import { server } from "@/test/msw";
import { setTestEnv } from "@/test/serverEnv";
let GET: typeof import("./route").GET;

const get = (id: string) => GET(new Request(`http://localhost:3000/bff/records/${id}/structure`), { params: Promise.resolve({ id }) });

const getWith = (id: string, query: string) =>
  GET(new Request(`http://localhost:3000/bff/records/${id}/structure${query}`), { params: Promise.resolve({ id }) });

const STRUCTURE = "*/api/rest/v1/projects/:id/structure";
const MAX = 50 * 1024 * 1024;

// The route keeps a module-level selection limiter; a fresh module per test keeps unread bodies from leaking slots between tests.
beforeEach(async () => {
  vi.resetModules();
  ({ GET } = await import("./route"));
  setTestEnv();
  server.use(...createMockBackend().handlers);
});

describe("GET /bff/records/[id]/structure", () => {
  it("serves the PDB anonymously with long-lived cache headers", async () => {
    const response = await get("MD-A00001");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("chemical/x-pdb");
    expect(response.headers.get("cache-control")).toBe("public, max-age=86400, stale-while-revalidate=604800");
    expect(await response.text()).toContain("ATOM");
  });

  it("returns 404 for an invalid id without calling MDposit", async () => {
    let called = false;
    server.use(http.get(STRUCTURE, () => ((called = true), HttpResponse.json({}))));
    for (const id of ["a..b", "a b", "-x"]) expect((await get(id)).status).toBe(404);
    expect(called).toBe(false);
  });

  it("returns 404 when upstream has no such record", async () => {
    expect((await get("MD-A99999")).status).toBe(404);
  });

  it("returns 404 for a non-PDB content type", async () => {
    server.use(http.get(STRUCTURE, () => new HttpResponse("<html></html>", { headers: { "Content-Type": "text/html" } })));
    expect((await get("MD-A00001")).status).toBe(404);
  });

  it("refuses a declared size over the cap", async () => {
    server.use(http.get(STRUCTURE, () => new HttpResponse("x", { headers: { "Content-Type": "chemical/x-pdb", "Content-Length": String(MAX + 1) } })));
    expect((await get("MD-A00001")).status).toBe(413);
  });

  it("errors the stream when an undeclared body crosses the cap", async () => {
    const chunk = new Uint8Array(MAX / 2 + 1);
    server.use(
      http.get(
        STRUCTURE,
        () =>
          new HttpResponse(new ReadableStream({ start: (c) => (c.enqueue(chunk), c.enqueue(chunk), c.close()) }), {
            headers: { "Content-Type": "chemical/x-pdb" },
          }),
      ),
    );
    const response = await get("MD-A00001");
    await expect(response.arrayBuffer()).rejects.toBeDefined();
  });

  it("follows one redirect to a mddbr.eu host and refuses other hosts", async () => {
    server.use(
      http.get(STRUCTURE, () => new HttpResponse(null, { status: 302, headers: { Location: "https://files.mddbr.eu/A0001/structure" } })),
      http.get("https://files.mddbr.eu/A0001/structure", () => new HttpResponse("ATOM\n", { headers: { "Content-Type": "chemical/x-pdb" } })),
    );
    expect((await get("MD-A00001")).status).toBe(200);
    // A different id: the canonical-path cache is process-wide and would otherwise skip the redirect for MD-A00001.
    server.use(http.get(STRUCTURE, () => new HttpResponse(null, { status: 302, headers: { Location: "https://evil.example/s" } })));
    expect((await get("MD-A00003")).status).toBe(502);
  });

  it("forwards a valid selection upstream", async () => {
    let selection: string | null = null;
    server.use(
      http.get(STRUCTURE, ({ request }) => {
        selection = new URL(request.url).searchParams.get("selection");
        return new HttpResponse("ATOM\n", { headers: { "Content-Type": "chemical/x-pdb" } });
      }),
    );
    expect((await getWith("MD-A00002", "?selection=protein")).status).toBe(200);
    expect(selection).toBe("protein");
  });

  it("answers 422 with a selection field error for control characters or over-long values", async () => {
    for (const value of ["pro\u0001tein", "a".repeat(301)]) {
      const response = await getWith("MD-A00002", `?selection=${encodeURIComponent(value)}`);
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ fieldErrors: { selection: "errors.field.invalid" } });
    }
  });

  it("drops Content-Length when the upstream body is content-encoded", async () => {
    server.use(
      http.get(
        STRUCTURE,
        () => new HttpResponse("ATOM\n", { headers: { "Content-Type": "chemical/x-pdb", "Content-Length": "5", "Content-Encoding": "gzip" } }),
      ),
    );
    expect((await get("MD-A00002")).headers.get("content-length")).toBeNull();
  });

  describe("selection concurrency limit", () => {
    const openStream = () =>
      server.use(
        http.get(STRUCTURE, () => {
          const body = new ReadableStream<Uint8Array>({ start: (c) => c.enqueue(new Uint8Array([65])) });
          return new HttpResponse(body, { headers: { "Content-Type": "chemical/x-pdb" } });
        }),
      );

    it("answers 429 problem+json with Retry-After beyond 16 concurrent selection streams and frees a slot on cancel", async () => {
      openStream();
      const open = await Promise.all(Array.from({ length: 16 }, () => getWith("MD-A00002", "?selection=protein")));
      expect(open.every((response) => response.status === 200)).toBe(true);

      const refused = await getWith("MD-A00002", "?selection=protein");
      expect(refused.status).toBe(429);
      expect(refused.headers.get("content-type")).toBe("application/problem+json");
      expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
      expect(await refused.json()).toMatchObject({ messageKey: "errors.http.too_many_streams" });

      await open[0]?.body?.cancel();
      const admitted = await getWith("MD-A00002", "?selection=protein");
      expect(admitted.status).toBe(200);
      await Promise.all([admitted, ...open.slice(1)].map((response) => response.body?.cancel()));
    });

    it("does not limit requests without a selection", async () => {
      openStream();
      const open = await Promise.all(Array.from({ length: 17 }, () => get("MD-A00002")));
      expect(open.every((response) => response.status === 200)).toBe(true);
      await Promise.all(open.map((response) => response.body?.cancel()));
    });

    it("frees the slot when the upstream fails or is missing", async () => {
      for (let i = 0; i < 20; i++) expect((await getWith("MD-A99999", "?selection=protein")).status).toBe(404);
    });

    it("frees the slot when the browser aborts before the body is read", async () => {
      openStream();
      const controllers = Array.from({ length: 16 }, () => new AbortController());
      await Promise.all(
        controllers.map((controller) =>
          GET(new Request("http://localhost:3000/bff/records/MD-A00002/structure?selection=protein", { signal: controller.signal }), {
            params: Promise.resolve({ id: "MD-A00002" }),
          }),
        ),
      );
      controllers.forEach((controller) => controller.abort());
      const next = await getWith("MD-A00002", "?selection=protein");
      expect(next.status).toBe(200);
      await next.body?.cancel();
    });
  });
});
