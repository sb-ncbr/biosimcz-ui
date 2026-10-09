import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockBackend } from "@/mocks/handlers";
import { server } from "@/test/msw";
import { setTestEnv } from "@/test/serverEnv";
let GET: typeof import("./route").GET;

const get = (id: string, query = "", signal?: AbortSignal) =>
  GET(new Request(`http://localhost:3000/bff/records/${id}/trajectory${query}`, { signal }), { params: Promise.resolve({ id }) });

const TRAJECTORY = "*/api/rest/v1/projects/:id/trajectory";
const GIB = 1024 * 1024 * 1024;

// The route keeps a module-level stream limiter; a fresh module per test keeps unread bodies from leaking slots between tests.
beforeEach(async () => {
  vi.resetModules();
  ({ GET } = await import("./route"));
  setTestEnv();
  server.use(...createMockBackend().handlers);
});

describe("GET /bff/records/[id]/trajectory", () => {
  it("streams the bytes with no-store and octet-stream", async () => {
    const response = await get("MD-A007L3.1", "?frames=1:10");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/octet-stream");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect((await response.arrayBuffer()).byteLength).toBe(4);
  });

  it("forwards format=xtc, frames and selection upstream", async () => {
    let params = new URLSearchParams();
    server.use(
      http.get(TRAJECTORY, ({ request }) => {
        params = new URL(request.url).searchParams;
        return new HttpResponse(new Uint8Array([1]), { headers: { "Content-Type": "application/octet-stream" } });
      }),
    );
    await (await get("MD-A007L3.1", "?frames=1:100:10&selection=protein")).arrayBuffer();
    expect(params.get("format")).toBe("xtc");
    expect(params.get("frames")).toBe("1:100:10");
    expect(params.get("selection")).toBe("protein");
  });

  it("treats blank parameters as unset", async () => {
    expect((await get("MD-A007L3.1", "?frames=&selection=")).status).toBe(200);
  });

  it("rejects a 0-based range with 422 and fieldErrors, without calling MDposit", async () => {
    let called = false;
    server.use(http.get(TRAJECTORY, () => ((called = true), new HttpResponse(new Uint8Array([1])))));
    const response = await get("MD-A007L3.1", "?frames=0:10");
    expect(response.status).toBe(422);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    expect(await response.json()).toMatchObject({ kind: "validation", fieldErrors: { frames: "errors.field.invalid" } });
    expect(called).toBe(false);
  });

  it("rejects a bad selection with a selection field error", async () => {
    const response = await get("MD-A007L3.1", `?selection=${encodeURIComponent("pro\u0001tein")}`);
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ fieldErrors: { selection: "errors.field.invalid" } });
  });

  it("returns 404 for a non-instance id", async () => {
    for (const id of ["MD-A007L3", "a..b.1", "a b.1"]) expect((await get(id)).status).toBe(404);
  });

  it("returns 404 when upstream has no trajectory", async () => {
    expect((await get("MD-A99999.1")).status).toBe(404);
  });

  it("maps an upstream 400 to 422 trajectory_rejected without upstream text", async () => {
    server.use(http.get(TRAJECTORY, () => HttpResponse.json("secret upstream detail", { status: 400 })));
    const response = await get("MD-A007L3.1", "?frames=1:5");
    expect(response.status).toBe(422);
    const text = await response.text();
    expect(text).toContain("trajectory_rejected");
    expect(text).not.toContain("secret");
  });

  it("accepts common binary content types and refuses HTML", async () => {
    server.use(http.get(TRAJECTORY, () => new HttpResponse(new Uint8Array([1]), { headers: { "Content-Type": "application/x-gzip" } })));
    expect((await get("MD-A007L3.1")).status).toBe(200);
    server.use(http.get(TRAJECTORY, () => new HttpResponse("<html>", { headers: { "Content-Type": "text/html" } })));
    expect((await get("MD-A007L3.1")).status).toBe(502);
  });

  it("answers 413 when the declared size is over the cap", async () => {
    server.use(
      http.get(TRAJECTORY, () => new HttpResponse("x", { headers: { "Content-Type": "application/octet-stream", "Content-Length": String(GIB + 1) } })),
    );
    expect((await get("MD-A007L3.1")).status).toBe(413);
  });

  it("answers 429 problem+json with Retry-After beyond 4 concurrent streams, and frees a slot on cancel", async () => {
    server.use(
      http.get(TRAJECTORY, () => {
        const body = new ReadableStream<Uint8Array>({ start: (c) => c.enqueue(new Uint8Array([1])) });
        return new HttpResponse(body, { headers: { "Content-Type": "application/octet-stream" } });
      }),
    );
    const open = await Promise.all([1, 2, 3, 4].map(() => get("MD-A007L3.1")));
    expect(open.every((response) => response.status === 200)).toBe(true);

    const refused = await get("MD-A007L3.1");
    expect(refused.status).toBe(429);
    expect(refused.headers.get("content-type")).toBe("application/problem+json");
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await refused.json()).toMatchObject({ messageKey: "errors.http.too_many_streams" });

    await open[0]?.body?.cancel();
    const admitted = await get("MD-A007L3.1");
    expect(admitted.status).toBe(200);
    await Promise.all([admitted, ...open.slice(1)].map((response) => response.body?.cancel()));
  });

  it("frees the slot when the upstream fails", async () => {
    server.use(http.get(TRAJECTORY, () => new HttpResponse(null, { status: 404 })));
    for (let i = 0; i < 6; i++) expect((await get("MD-A99999.1")).status).toBe(404);
  });

  it("aborts the upstream request when the browser cancels",async () => {
    let upstreamAborted = false;
    const controller = new AbortController();
    server.use(
      http.get(TRAJECTORY, async ({ request }) => {
        request.signal.addEventListener("abort", () => (upstreamAborted = true));
        controller.abort();
        await new Promise((resolve) => setTimeout(resolve, 200));
        return new HttpResponse(new Uint8Array([1]), { headers: { "Content-Type": "application/octet-stream" } });
      }),
    );
    const response = await get("MD-A007L3.1", "", controller.signal);
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(upstreamAborted).toBe(true);
  });
});
