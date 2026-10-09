import "server-only";
import { z } from "zod";
import { getEnv } from "@/server/config/env";
import {
  commitDraftFile,
  deleteDraftFile,
  initDraftFile,
  parseDraftFile,
  putDraftFileContent,
} from "@/server/backends/mdrepo/client";
import { ApiError, problemResponse } from "@/server/http/errors";
import { logger } from "@/server/lib/logger";
import { assertSameOrigin, requireSession, withUpstream, type CookieJar } from "@/server/session";
import { fileKeyProblem, isValidDraftId } from "../lib/keys";

type FileParams = { draftId: string; key: string };

const MAX_JSON_BYTES = 4096;

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const noContent = (): Response => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

const reject = (status: number, code: string): ApiError => {
  const kind = status === 422 ? "validation" : "http";
  return new ApiError({ kind, backend: "mdrepo", status, code });
};

// Same order everywhere: CSRF, session, then input. Unauthenticated callers learn nothing about validation rules.
const guard = async (req: Request, jar: CookieJar): Promise<void> => {
  assertSameOrigin(req);
  await requireSession(jar);
};

const checkDraftId = (draftId: string): void => {
  if (!isValidDraftId(draftId)) throw reject(422, "invalid_draft_id");
};

const checkKey = (key: string): void => {
  if (fileKeyProblem(key) !== null) throw reject(422, "invalid_key");
};

const checkParams = ({ draftId, key }: FileParams): void => {
  checkDraftId(draftId);
  checkKey(key);
};

const mediaType = (value: string | null): string => (value ?? "").split(";")[0]?.trim().toLowerCase() ?? "";

const handle = async (run: () => Promise<Response>): Promise<Response> => {
  try {
    return await run();
  } catch (error) {
    if (!(error instanceof ApiError)) logger.error("upload route failed", { error: error instanceof Error ? error.name : "unknown" });
    return problemResponse(error);
  }
};

const initBody = z.object({ key: z.string() });

// POST /bff/depositions/[draftId]/files  { key }  -> upstream #17
const initFile = (req: Request, params: { draftId: string }, jar: CookieJar): Promise<Response> =>
  handle(async () => {
    await guard(req, jar);
    checkDraftId(params.draftId);
    if (mediaType(req.headers.get("content-type")) !== "application/json") throw reject(415, "unsupported_media_type");
    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > MAX_JSON_BYTES) throw reject(413, "too_large");
    const text = await req.text();
    if (text.length > MAX_JSON_BYTES) throw reject(413, "too_large");
    let parsed: z.infer<typeof initBody>;
    try {
      parsed = initBody.parse(JSON.parse(text));
    } catch {
      throw reject(422, "invalid_body");
    }
    checkKey(parsed.key);
    await withUpstream(jar, (auth) => initDraftFile(params.draftId, parsed.key, auth));
    return json({ key: parsed.key }, 201);
  });

// Counts bytes as they pass and errors the stream when the declared size is exceeded or not met, so a client that
// lies in Content-Length cannot push more than the limit or leave a truncated file upstream.
const guardedStream = (body: ReadableStream<Uint8Array>, declared: number, state: { exceeded: boolean }): ReadableStream<Uint8Array> => {
  let seen = 0;
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        seen += chunk.byteLength;
        if (seen > declared) {
          state.exceeded = true;
          controller.error(new Error("body exceeds declared size"));
          return;
        }
        controller.enqueue(chunk);
      },
      flush(controller) {
        if (seen !== declared) controller.error(new Error("body shorter than declared size"));
      },
    }),
  );
};

// PUT /bff/depositions/[draftId]/files/[key]/content  (octet-stream) -> upstream #18, streamed, never buffered
const putContent = (req: Request, params: FileParams, jar: CookieJar): Promise<Response> =>
  handle(async () => {
    await guard(req, jar);
    checkParams(params);
    if (mediaType(req.headers.get("content-type")) !== "application/octet-stream") throw reject(415, "unsupported_media_type");
    const header = req.headers.get("content-length");
    if (header === null || !/^\d+$/.test(header)) throw reject(411, "length_required");
    const declared = Number(header);
    if (declared === 0) throw reject(422, "empty_file");
    if (declared > getEnv().uploadMaxBytes) throw reject(413, "too_large");
    if (!req.body) throw reject(422, "empty_file");

    const state = { exceeded: false };
    const body = guardedStream(req.body, declared, state);
    let used = false;
    try {
      await withUpstream(jar, (auth) => {
        // A consumed stream cannot be replayed after a 401 refresh. Fail with a retryable conflict instead of
        // sending a broken body; the client retries the whole upload with the refreshed session.
        if (used) throw new ApiError({ kind: "conflict", backend: "mdrepo", code: "stream_not_replayable" });
        used = true;
        return putDraftFileContent(params.draftId, params.key, body, auth, declared);
      });
    } catch (error) {
      if (state.exceeded) throw reject(413, "too_large");
      throw error;
    }
    return noContent();
  });

// POST .../commit -> upstream #19
const commitFile = (req: Request, params: FileParams, jar: CookieJar): Promise<Response> =>
  handle(async () => {
    await guard(req, jar);
    checkParams(params);
    await withUpstream(jar, (auth) => commitDraftFile(params.draftId, params.key, auth));
    return json({ key: params.key });
  });

// DELETE .../[key] -> upstream E-D5
// TODO(backend): E-D5 path unconfirmed (client.ts).
const deleteFile = (req: Request, params: FileParams, jar: CookieJar): Promise<Response> =>
  handle(async () => {
    await guard(req, jar);
    checkParams(params);
    await withUpstream(jar, (auth) => deleteDraftFile(params.draftId, params.key, auth));
    return noContent();
  });

// POST .../parse -> upstream E-D6. Only camelCase values the UI needs cross the boundary.
// TODO(backend): E-D6 path unconfirmed (client.ts).
const parseFile = (req: Request, params: FileParams, jar: CookieJar): Promise<Response> =>
  handle(async () => {
    await guard(req, jar);
    checkParams(params);
    const { data } = await withUpstream(jar, (auth) => parseDraftFile(params.draftId, params.key, auth));
    return json({
      status: data.status,
      ...(data.detected_role && { detectedRole: data.detected_role }),
      fields: data.fields,
      warnings: data.warnings.map((warning) => ({ code: warning.code })),
    });
  });

export { commitFile, deleteFile, initFile, parseFile, putContent };
export type { FileParams };
