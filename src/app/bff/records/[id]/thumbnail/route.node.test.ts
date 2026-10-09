import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { createMockBackend } from "@/mocks/handlers";
import { server } from "@/test/msw";
import { setTestEnv } from "@/test/serverEnv";
import { GET } from "./route";

const get = (id: string) => GET(new Request(`http://localhost:3000/bff/records/${id}/thumbnail`), { params: Promise.resolve({ id }) });

const SCREENSHOT = "*/api/rest/v1/projects/:id/files/screenshot.jpg";
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

beforeEach(() => {
  setTestEnv();
  server.use(...createMockBackend().handlers);
});

describe("GET /bff/records/[id]/thumbnail", () => {
  it("serves the image anonymously with long-lived cache headers", async () => {
    const response = await get("MD-A00001");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("public, max-age=86400, stale-while-revalidate=604800");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });

  it("returns 404 for an invalid id without calling MDposit", async () => {
    let called = false;
    server.use(http.get(SCREENSHOT, () => ((called = true), HttpResponse.json({}))));
    for (const id of ["a..b", "a b", "-x", "x".repeat(65)]) expect((await get(id)).status).toBe(404);
    expect(called).toBe(false);
  });

  it("detects the image by its bytes when the upstream says application/octet-stream (live MDposit)", async () => {
    server.use(http.get(SCREENSHOT, () => new HttpResponse(png, { headers: { "Content-Type": "application/octet-stream" } })));
    const response = await get("MD-A00001");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
  });

  it("returns 404 for a non-image content type", async () => {
    server.use(http.get(SCREENSHOT, () => new HttpResponse("<html></html>", { headers: { "Content-Type": "text/html" } })));
    expect((await get("MD-A00001")).status).toBe(404);
  });

  it("returns 404 when the bytes are not an image", async () => {
    server.use(http.get(SCREENSHOT, () => new HttpResponse("not an image", { headers: { "Content-Type": "image/png" } })));
    expect((await get("MD-A00001")).status).toBe(404);
  });

  it("returns 404 for SVG", async () => {
    server.use(
      http.get(
        SCREENSHOT,
        () => new HttpResponse("<svg xmlns='http://www.w3.org/2000/svg'/>", { headers: { "Content-Type": "image/svg+xml" } }),
      ),
    );
    expect((await get("MD-A00001")).status).toBe(404);
  });

  it("returns 404 for a body over 2 MB (declared and streamed)", async () => {
    const big = new Uint8Array(2 * 1024 * 1024 + 1);
    big.set(png);
    server.use(http.get(SCREENSHOT, () => new HttpResponse(big, { headers: { "Content-Type": "image/png" } })));
    expect((await get("MD-A00001")).status).toBe(404);
    server.use(
      http.get(
        SCREENSHOT,
        () =>
          new HttpResponse(new ReadableStream({ start: (c) => (c.enqueue(big), c.close()) }), { headers: { "Content-Type": "image/png" } }),
      ),
    );
    expect((await get("MD-A00001")).status).toBe(404);
  });

  it("returns 404 when upstream has no screenshot", async () => {
    expect((await get("MD-A99999")).status).toBe(404);
  });

  it("follows one redirect to a mddbr.eu host and refuses other hosts", async () => {
    server.use(
      http.get(SCREENSHOT, () => new HttpResponse(null, { status: 302, headers: { Location: "https://files.mddbr.eu/shot.jpg" } })),
      http.get("https://files.mddbr.eu/shot.jpg", () => new HttpResponse(png, { headers: { "Content-Type": "application/octet-stream" } })),
    );
    expect((await get("MD-A00001")).status).toBe(200);

    server.use(http.get(SCREENSHOT, () => new HttpResponse(null, { status: 302, headers: { Location: "https://evil.example/shot.jpg" } })));
    expect((await get("MD-A00001")).status).toBe(502);
  });
});
