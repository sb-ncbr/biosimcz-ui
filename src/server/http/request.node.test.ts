import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { server } from "@/test/msw";
import { setTestEnv } from "@/test/serverEnv";
import { ApiError, fromResponseBody, problemResponse, toDTO } from "./errors";
import { buildUrl, request, requestRaw, requestVoid } from "./request";

const fast = { retries: 2, baseDelayMs: 1 };
const anything = z.unknown();

beforeEach(() => setTestEnv());

describe("path encoding", () => {
  it("encodes every segment, including #, ?, / and spaces", () => {
    expect(buildUrl("mdrepo", ["api", "experiments", "a1", "draft", "files", "my file#1?/x.top", "content"])).toBe(
      "http://mdrepo.test/api/experiments/a1/draft/files/my%20file%231%3F%2Fx.top/content",
    );
  });

  it("neutralises dot segments", () => {
    expect(buildUrl("mdrepo", ["api", "..", "admin"])).toBe("http://mdrepo.test/api/%2E%2E/admin");
  });

  it("appends query values, arrays and skips undefined", () => {
    expect(buildUrl("mdposit", ["projects"], { search: "a b", page: 2, tag: ["x", "y"], skip: undefined })).toBe(
      "http://mdposit.test/api/rest/v1/projects?search=a+b&page=2&tag=x&tag=y",
    );
  });

  it("keeps the trailing slash of the create-draft path", () => {
    expect(buildUrl("mdrepo", ["api", "experiments", ""])).toBe("http://mdrepo.test/api/experiments/");
  });

  it("delivers an encoded key to the server intact", async () => {
    let seen = "";
    server.use(
      http.put("http://mdrepo.test/api/x/:key", ({ request: req }) => {
        seen = new URL(req.url).pathname;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await requestVoid("mdrepo", "PUT", ["api", "x", "a#b c"], { body: "data" });
    expect(seen).toBe("/api/x/a%23b%20c");
  });
});

describe("request bodies and headers", () => {
  it("sets JSON content type only for plain objects", async () => {
    let contentType: string | null = null;
    server.use(
      http.post("http://mdrepo.test/api/j", ({ request: req }) => {
        contentType = req.headers.get("content-type");
        return HttpResponse.json({});
      }),
    );
    await request("mdrepo", "POST", ["api", "j"], anything, { json: { a: 1 } });
    expect(contentType).toBe("application/json");
    await expect(request("mdrepo", "POST", ["api", "j"], anything, { json: new Date() })).rejects.toThrow(TypeError);
  });

  it("does not invent a JSON content type for FormData", async () => {
    let contentType: string | null = null;
    server.use(
      http.post("http://mdrepo.test/api/f", ({ request: req }) => {
        contentType = req.headers.get("content-type");
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const form = new FormData();
    form.append("logo", new Blob(["x"]), "logo.png");
    await requestVoid("mdrepo", "POST", ["api", "f"], { body: form });
    expect(contentType).toMatch(/^multipart\/form-data; boundary=/);
  });

  it("streams a ReadableStream body without buffering errors", async () => {
    let size = 0;
    server.use(
      http.put("http://mdrepo.test/api/s", async ({ request: req }) => {
        size = (await req.arrayBuffer()).byteLength;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(1000));
        controller.enqueue(new Uint8Array(24));
        controller.close();
      },
    });
    await requestVoid("mdrepo", "PUT", ["api", "s"], { body: stream, timeoutMs: null, retry: false });
    expect(size).toBe(1024);
  });
});

describe("error normalisation", () => {
  it.each([
    [401, "auth"],
    [403, "forbidden"],
    [404, "not_found"],
    [409, "conflict"],
    [412, "conflict"],
    [400, "validation"],
    [422, "validation"],
    [500, "http"],
    [413, "http"],
  ])("maps status %i to kind %s", async (status, kind) => {
    server.use(http.get("http://mdrepo.test/api/e", () => HttpResponse.json({ code: "some_code" }, { status })));
    const error = await request("mdrepo", "GET", ["api", "e"], anything, { retry: false }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind, status, code: "some_code", backend: "mdrepo" });
  });

  it("extracts field errors in the proposed and Invenio shapes", () => {
    const proposed = fromResponseBody("mdrepo", 422, {
      errors: [{ field: "metadata.study.title", code: "required", message: "Title is required" }],
    });
    expect(proposed.fieldErrors).toEqual({ "metadata.study.title": "errors.field.required" });
    const invenio = fromResponseBody("mdrepo", 400, { errors: [{ field: "slug", messages: ["Bad"] }] });
    expect(invenio.fieldErrors).toEqual({ slug: "errors.field.invalid" });
  });

  it("survives non-JSON bodies", async () => {
    server.use(http.get("http://mdrepo.test/api/e", () => new HttpResponse("<html>oops</html>", { status: 502 })));
    const error = await request("mdrepo", "GET", ["api", "e"], anything, { retry: false }).catch((e: unknown) => e);
    expect(error).toMatchObject({ kind: "http", status: 502 });
  });

  it("never leaks upstream text or unknown codes into the DTO", () => {
    const error = fromResponseBody("mdrepo", 400, { code: "x y<script>", message: "secret upstream detail" });
    const dto = toDTO(error);
    expect(JSON.stringify(dto)).not.toContain("secret");
    expect(dto.code).toBeUndefined();
    expect(toDTO(new Error("boom"))).toEqual({ kind: "http", code: "unexpected", messageKey: "errors.unexpected" });
  });

  it("renders problem+json with a browser-facing status", async () => {
    const response = problemResponse(fromResponseBody("mdrepo", 412, { code: "revision_mismatch" }));
    expect(response.status).toBe(409);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    expect(await response.json()).toMatchObject({ kind: "conflict", messageKey: "errors.conflict.revision_mismatch" });
  });

  it("reports a schema mismatch as kind schema", async () => {
    server.use(http.get("http://mdrepo.test/api/e", () => HttpResponse.json({ wrong: true })));
    const error = await request("mdrepo", "GET", ["api", "e"], z.object({ id: z.string() })).catch((e: unknown) => e);
    expect(error).toMatchObject({ kind: "schema", backend: "mdrepo" });
  });

  it("reports network failures and timeouts", async () => {
    server.use(http.get("http://mdrepo.test/api/n", () => HttpResponse.error()));
    await expect(request("mdrepo", "GET", ["api", "n"], anything, { retry: false })).rejects.toMatchObject({ kind: "network" });

    server.use(
      http.get("http://mdrepo.test/api/slow", async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return HttpResponse.json({});
      }),
    );
    await expect(request("mdrepo", "GET", ["api", "slow"], anything, { timeoutMs: 20, retry: false })).rejects.toMatchObject({
      kind: "timeout",
    });
  });

  it("does not follow redirects with credentials", async () => {
    server.use(
      http.get("http://mdrepo.test/api/r", () => new HttpResponse(null, { status: 302, headers: { Location: "http://evil.test/" } })),
    );
    await expect(requestRaw("mdrepo", "GET", ["api", "r"], { retry: false })).rejects.toBeInstanceOf(ApiError);
  });
});

describe("retry policy", () => {
  it("retries GET on 503 and then succeeds", async () => {
    let calls = 0;
    server.use(
      http.get("http://mdrepo.test/api/flaky", () => {
        calls++;
        return calls < 3 ? new HttpResponse(null, { status: 503 }) : HttpResponse.json({ ok: true });
      }),
    );
    const result = await request("mdrepo", "GET", ["api", "flaky"], anything, { retry: fast });
    expect(result.data).toEqual({ ok: true });
    expect(calls).toBe(3);
  });

  it("gives up after the retry budget", async () => {
    let calls = 0;
    server.use(
      http.get("http://mdrepo.test/api/down", () => {
        calls++;
        return new HttpResponse(null, { status: 502 });
      }),
    );
    await expect(request("mdrepo", "GET", ["api", "down"], anything, { retry: fast })).rejects.toMatchObject({ status: 502 });
    expect(calls).toBe(3);
  });

  it("never retries 4xx or non-idempotent methods", async () => {
    let gets = 0;
    let posts = 0;
    server.use(
      http.get("http://mdrepo.test/api/nf", () => {
        gets++;
        return new HttpResponse(null, { status: 404 });
      }),
      http.post("http://mdrepo.test/api/p", () => {
        posts++;
        return new HttpResponse(null, { status: 503 });
      }),
    );
    await request("mdrepo", "GET", ["api", "nf"], anything, { retry: fast }).catch(() => undefined);
    await request("mdrepo", "POST", ["api", "p"], anything, { retry: fast }).catch(() => undefined);
    expect(gets).toBe(1);
    expect(posts).toBe(1);
  });

  it("retries network errors on idempotent requests", async () => {
    let calls = 0;
    server.use(
      http.get("http://mdrepo.test/api/net", () => {
        calls++;
        return calls === 1 ? HttpResponse.error() : HttpResponse.json({});
      }),
    );
    await request("mdrepo", "GET", ["api", "net"], anything, { retry: fast });
    expect(calls).toBe(2);
  });
});
