import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { createMockBackend } from "@/mocks/handlers";
import { server } from "@/test/msw";
import { setTestEnv } from "@/test/serverEnv";
import { GET } from "./route";

const get = (id: string, name: string, signal?: AbortSignal) =>
  GET(new Request(`http://localhost:3000/bff/records/${id}/analyses/${name}`, { signal }), { params: Promise.resolve({ id, name }) });

const ANALYSIS = "*/api/rest/v1/projects/:id/analyses/:name";

beforeEach(() => {
  setTestEnv();
  server.use(...createMockBackend().handlers);
});

describe("GET /bff/records/[id]/analyses/[name]", () => {
  it("relays the JSON payload with cache and sniffing headers", async () => {
    const response = await get("MD-A007L3.1", "rgyr");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(response.headers.get("cache-control")).toBe("public, max-age=3600, stale-while-revalidate=86400");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.json()).toHaveProperty("y");
  });

  it("returns 404 for invalid ids and names without calling MDposit", async () => {
    let called = false;
    server.use(http.get(ANALYSIS, () => ((called = true), HttpResponse.json({}))));
    for (const [id, name] of [
      ["MD-A007L3", "rgyr"],
      ["a..b.1", "rgyr"],
      ["MD-A007L3.1", "../x"],
      ["MD-A007L3.1", "unknown-thing"],
      ["MD-A007L3.1", "RGYR"],
    ] as const) {
      const response = await get(id, name);
      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toBe("public, max-age=300");
    }
    expect(called).toBe(false);
  });

  it("returns 404 when upstream has no such analysis", async () => {
    expect((await get("MD-A007L3.1", "dist-perres-mean")).status).toBe(404);
  });

  it("answers 502 bad_content_type for a non-JSON upstream", async () => {
    server.use(http.get(ANALYSIS, () => new HttpResponse("<html></html>", { headers: { "Content-Type": "text/html" } })));
    const response = await get("MD-A007L3.1", "rgyr");
    expect(response.status).toBe(502);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    expect(await response.json()).toMatchObject({ code: "bad_content_type" });
  });

  it("answers 413 when the declared size is over the cap", async () => {
    server.use(
      http.get(ANALYSIS, () => new HttpResponse("{}", { headers: { "Content-Type": "application/json", "Content-Length": String(17 * 1024 * 1024) } })),
    );
    const response = await get("MD-A007L3.1", "rgyr");
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ code: "too_large" });
  });

  it("answers 502 for a redirect to a disallowed host and does not leak the host", async () => {
    server.use(http.get(ANALYSIS, () => new HttpResponse(null, { status: 302, headers: { Location: "https://evil.example/a" } })));
    const response = await get("MD-A007L3.1", "rgyr");
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("evil.example");
  });

  it("does not relay upstream error text", async () => {
    server.use(http.get(ANALYSIS, () => HttpResponse.json({ message: "secret upstream detail" }, { status: 500 })));
    const response = await get("MD-A007L3.1", "rgyr");
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("secret");
  });
});
