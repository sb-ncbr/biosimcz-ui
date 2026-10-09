import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { server } from "@/test/msw";
import { setTestEnv } from "@/test/serverEnv";
import { MAX_ANALYSIS_BYTES, openAnalysisStream, openTrajectoryStream } from "./streams";

const BASE = "http://mdposit.test/api/rest/v1/projects/MD-A007L3.1";
const JSON_HEADERS = { "content-type": "application/json" };

beforeEach(() => {
  setTestEnv();
});

describe("openAnalysisStream", () => {
  it("relays the body unparsed as application/json", async () => {
    server.use(http.get(`${BASE}/analyses/rgyr`, () => HttpResponse.json({ a: 1 })));
    const stream = await openAnalysisStream("MD-A007L3.1", "rgyr");
    expect(stream?.contentType).toBe("application/json");
    expect(await new Response(stream?.body).text()).toBe('{"a":1}');
  });

  it("404 -> null", async () => {
    server.use(http.get(`${BASE}/analyses/rgyr`, () => new HttpResponse(null, { status: 404 })));
    expect(await openAnalysisStream("MD-A007L3.1", "rgyr")).toBeNull();
  });

  it("refuses a non-JSON content type with 502 bad_content_type", async () => {
    server.use(http.get(`${BASE}/analyses/rgyr`, () => new HttpResponse("<html>", { headers: { "content-type": "text/html" } })));
    await expect(openAnalysisStream("MD-A007L3.1", "rgyr")).rejects.toMatchObject({ status: 502, code: "bad_content_type" });
  });

  it("refuses a declared size over the cap with 413", async () => {
    server.use(
      http.get(
        `${BASE}/analyses/rgyr`,
        () => new HttpResponse("{}", { headers: { ...JSON_HEADERS, "content-length": String(MAX_ANALYSIS_BYTES + 1) } }),
      ),
    );
    await expect(openAnalysisStream("MD-A007L3.1", "rgyr")).rejects.toMatchObject({ status: 413, code: "too_large" });
  });

  it("drops Content-Length when the upstream body is content-encoded", async () => {
    server.use(
      http.get(`${BASE}/analyses/rgyr`, () => new HttpResponse("{}", { headers: { ...JSON_HEADERS, "content-length": "2", "content-encoding": "gzip" } })),
    );
    expect((await openAnalysisStream("MD-A007L3.1", "rgyr"))?.contentLength).toBeNull();
  });

  it("follows the upstream redirect once", async () => {
    server.use(
      http.get(
        "http://mdposit.test/api/rest/v1/projects/MD-A007L3.2/analyses/pca",
        () => new HttpResponse(null, { status: 302, headers: { location: "https://x.mddbr.eu/api/rest/v1/projects/MD-A007L3.2/analyses/pca" } }),
      ),
      http.get("https://x.mddbr.eu/api/rest/v1/projects/MD-A007L3.2/analyses/pca", () => HttpResponse.json({ ok: true })),
    );
    const stream = await openAnalysisStream("MD-A007L3.2", "pca");
    expect(await new Response(stream?.body).json()).toEqual({ ok: true });
  });
});

describe("openTrajectoryStream", () => {
  it("sends format=xtc with frames and selection and relays octet-stream", async () => {
    let params = new URLSearchParams();
    server.use(
      http.get(`${BASE}/trajectory`, ({ request }) => {
        params = new URL(request.url).searchParams;
        return new HttpResponse(new Uint8Array([1, 2, 3]), { headers: { "content-type": "application/octet-stream" } });
      }),
    );
    const stream = await openTrajectoryStream("MD-A007L3.1", { frames: "1:10:2", selection: "protein" }, new AbortController().signal);
    expect(params.get("format")).toBe("xtc");
    expect(params.get("frames")).toBe("1:10:2");
    expect(params.get("selection")).toBe("protein");
    expect(new Uint8Array(await new Response(stream?.body).arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("maps upstream 400 to our own 422 trajectory_rejected without upstream text", async () => {
    server.use(http.get(`${BASE}/trajectory`, () => HttpResponse.json({ message: "secret upstream detail" }, { status: 400 })));
    const error = await openTrajectoryStream("MD-A007L3.1", { frames: "5:1" }, new AbortController().signal).catch((e: unknown) => e);
    expect(error).toMatchObject({ kind: "validation", status: 422, code: "trajectory_rejected" });
    expect((error as Error).message).not.toContain("secret");
  });

  it("404 -> null", async () => {
    server.use(http.get(`${BASE}/trajectory`, () => new HttpResponse(null, { status: 404 })));
    expect(await openTrajectoryStream("MD-A007L3.1", {}, new AbortController().signal)).toBeNull();
  });

  it("forwards the abort signal upstream", async () => {
    const controller = new AbortController();
    server.use(
      http.get(`${BASE}/trajectory`, async () => {
        controller.abort();
        await new Promise((resolve) => setTimeout(resolve, 200));
        return new HttpResponse(new Uint8Array([1]), { headers: { "content-type": "application/octet-stream" } });
      }),
    );
    await expect(openTrajectoryStream("MD-A007L3.1", {}, controller.signal)).rejects.toMatchObject({ code: "aborted" });
  });
});

describe("stream calls do not retry", () => {
  it("calls the upstream once when it answers 503 (analysis)", async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/analyses/rgyr`, () => {
        calls++;
        return new HttpResponse(null, { status: 503 });
      }),
    );
    await expect(openAnalysisStream("MD-A007L3.1", "rgyr")).rejects.toMatchObject({ status: 503 });
    expect(calls).toBe(1);
  });

  it("calls the upstream once when it answers 503 (trajectory)", async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/trajectory`, () => {
        calls++;
        return new HttpResponse(null, { status: 503 });
      }),
    );
    await expect(openTrajectoryStream("MD-A007L3.1", {}, new AbortController().signal)).rejects.toMatchObject({ status: 503 });
    expect(calls).toBe(1);
  });
});
