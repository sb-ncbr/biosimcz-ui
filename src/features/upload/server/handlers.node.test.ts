import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMockBackend, type MockBackend } from "@/mocks/handlers";
import { createMemoryJar, signInJar, type MemoryJar } from "@/test/memoryJar";
import { server } from "@/test/msw";
import { setTestEnv } from "@/test/serverEnv";
import { commitFile, deleteFile, initFile, parseFile, putContent } from "./handlers";

const ORIGIN = "http://localhost:3000";
const DRAFT = "draft-empty";

let backend: MockBackend;
let jar: MemoryJar;

beforeEach(async () => {
  setTestEnv({ UPLOAD_MAX_BYTES: "1000" });
  backend = createMockBackend();
  server.use(...backend.handlers);
  jar = createMemoryJar();
  await signInJar(jar, backend.state);
});

afterEach(() => {
  delete process.env["UPLOAD_MAX_BYTES"];
});

const same = { origin: ORIGIN };

const init = (key: unknown, headers: Record<string, string> = same, draftId = DRAFT) =>
  initFile(
    new Request(`${ORIGIN}/bff/depositions/${draftId}/files`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ key }),
    }),
    { draftId },
    jar,
  );

// A real ReadableStream of small chunks, like a request body arriving over the network.
const streamOf = (chunks: number, chunkSize: number): ReadableStream<Uint8Array> => {
  let sent = 0;
  return new ReadableStream({
    pull(controller) {
      if (sent === chunks) return controller.close();
      controller.enqueue(new Uint8Array(chunkSize).fill(65));
      sent++;
    },
  });
};

const put = (
  key: string,
  body: ReadableStream<Uint8Array> | null,
  declared: number | undefined,
  headers: Record<string, string> = {},
  draftId = DRAFT,
) =>
  putContent(
    new Request(`${ORIGIN}/bff/depositions/${draftId}/files/x/content`, {
      method: "PUT",
      headers: {
        origin: ORIGIN,
        "content-type": "application/octet-stream",
        ...(declared !== undefined && { "content-length": String(declared) }),
        ...headers,
      },
      body,
      duplex: "half",
    } as RequestInit),
    { draftId, key },
    jar,
  );

const draftFile = (key: string) => backend.state.drafts.get(DRAFT)?.files.find((file) => file.key === key);
const problemOf = async (response: Response) => (await response.json()) as { kind: string; code?: string };

describe("upload BFF handlers: full pipeline against the mock", () => {
  it("init, streamed content, commit and parse for a key with spaces and #", async () => {
    const key = "my topol #1.top";
    expect((await init(key)).status).toBe(201);
    expect(draftFile(key)?.status).toBe("pending");

    // 4 chunks of 100 bytes, streamed through without the handler collecting them.
    const uploaded = await put(key, streamOf(4, 100), 400);
    expect(uploaded.status).toBe(204);
    expect(draftFile(key)?.size).toBe(400);

    const params = { draftId: DRAFT, key };
    const commit = await commitFile(new Request(ORIGIN, { method: "POST", headers: same }), params, jar);
    expect(commit.status).toBe(200);
    expect(draftFile(key)?.status).toBe("completed");

    const parsed = await parseFile(new Request(ORIGIN, { method: "POST", headers: same }), params, jar);
    expect(await parsed.json()).toMatchObject({ status: "ok", detectedRole: "topology", fields: expect.arrayContaining([expect.objectContaining({ path: "system.engine.name" })]) });

    const removed = await deleteFile(new Request(ORIGIN, { method: "DELETE", headers: same }), params, jar);
    expect(removed.status).toBe(204);
    expect(draftFile(key)).toBeUndefined();
  });

  it("maps an unreadable parse result through", async () => {
    const key = "topol.unreadable.top";
    await init(key);
    await put(key, streamOf(1, 10), 10);
    const params = { draftId: DRAFT, key };
    await commitFile(new Request(ORIGIN, { method: "POST", headers: same }), params, jar);
    const parsed = await parseFile(new Request(ORIGIN, { method: "POST", headers: same }), params, jar);
    expect(await parsed.json()).toMatchObject({ status: "unreadable", fields: [] });
  });

  it("surfaces a simulated content failure once, then succeeds on retry", async () => {
    const key = "conf.fail-once.gro";
    expect((await init(key)).status).toBe(201);
    const first = await put(key, streamOf(2, 50), 100);
    expect(first.status).toBeGreaterThanOrEqual(500);
    // Init again like a manual retry does; the fault was consumed.
    expect((await init(key)).status).toBe(201);
    expect((await put(key, streamOf(2, 50), 100)).status).toBe(204);
  });

  it("never leaks upstream credentials in responses", async () => {
    const response = await init("a.top");
    const text = JSON.stringify([...response.headers.entries()]) + (await response.text());
    expect(text).not.toMatch(/mdr\.session|authorization|set-cookie|bearer/i);
  });
});

describe("upload BFF handlers: request guards", () => {
  it("requires the same origin on every write", async () => {
    expect((await init("a.top", { origin: "https://evil.example" })).status).toBe(403);
    expect((await init("a.top", {})).status).toBe(403);
    const params = { draftId: DRAFT, key: "a.top" };
    for (const handler of [commitFile, deleteFile, parseFile]) {
      const response = await handler(new Request(ORIGIN, { method: "POST", headers: { origin: "https://evil.example" } }), params, jar);
      expect(response.status).toBe(403);
    }
    const put403 = await put("a.top", streamOf(1, 1), 1, { origin: "https://evil.example" });
    expect(put403.status).toBe(403);
  });

  it("requires a session", async () => {
    jar = createMemoryJar();
    expect((await init("a.top")).status).toBe(401);
    expect((await put("a.top", streamOf(1, 1), 1)).status).toBe(401);
  });

  it("validates the draft id and rejects path traversal in the key", async () => {
    for (const draftId of ["..", "a b", "x/../y", "a%2Fb"]) {
      expect((await init("a.top", same, draftId)).status).toBe(422);
    }
    for (const key of ["../secret.top", "a/b.top", "a\\b.top", "..top", "run.exe", "x".repeat(300) + ".top"]) {
      const response = await init(key);
      expect(response.status).toBe(422);
      expect((await problemOf(response)).code).toBe("invalid_key");
      expect((await put(key, streamOf(1, 1), 1)).status).toBe(422);
      expect(backend.state.drafts.get(DRAFT)?.files.some((f) => f.key === key)).toBe(false);
    }
  });

  it("rejects malformed init bodies and the wrong content type", async () => {
    expect((await init(42)).status).toBe(422);
    const wrongType = await initFile(
      new Request(ORIGIN, { method: "POST", headers: { ...same, "content-type": "text/plain" }, body: '{"key":"a.top"}' }),
      { draftId: DRAFT },
      jar,
    );
    expect(wrongType.status).toBe(415);
  });

  it("checks the content type, length header and size limit before contacting the backend", async () => {
    await init("a.top");
    expect((await put("a.top", streamOf(1, 1), 1, { "content-type": "text/plain" })).status).toBe(415);
    expect((await put("a.top", streamOf(1, 1), undefined)).status).toBe(411);
    expect((await put("a.top", streamOf(1, 1), 1, { "content-length": "abc" })).status).toBe(411);
    expect((await put("a.top", streamOf(1, 1), 0)).status).toBe(422);
    expect((await put("a.top", streamOf(1, 1), 1001)).status).toBe(413);
    expect((await put("a.top", null, 5)).status).toBe(422);
    expect(draftFile("a.top")?.size).toBe(0);
  });

  it("stops a body that is larger than the declared length", async () => {
    await init("a.top");
    const response = await put("a.top", streamOf(10, 100), 500);
    expect(response.status).toBe(413);
    expect(draftFile("a.top")?.size).toBe(0);
  });

  it("stops a body that is shorter than the declared length", async () => {
    await init("a.top");
    const response = await put("a.top", streamOf(2, 100), 500);
    expect(response.ok).toBe(false);
    expect(draftFile("a.top")?.size).toBe(0);
  });
});
