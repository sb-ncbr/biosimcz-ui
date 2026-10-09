import { z } from "zod";
import { draftSchema, isDraftId, toFieldErrors } from "@/entities/deposition";
import { ApiError, isApiError, problemResponse } from "@/server/http/errors";
import { logger } from "@/server/lib/logger";
import { getDraft, saveDraft } from "@/server/repositories/deposition";
import { assertSameOrigin, nextCookieJar, requireSession } from "@/server/session";

type RouteContext = { params: Promise<{ draftId: string }> };

// The draft is small (well under 100 KB in practice); this only stops abuse before parsing.
const MAX_BODY_BYTES = 1_048_576;

const bodySchema = z.object({ draft: z.unknown(), revision: z.number().int().min(0) });

const noStore = { "Cache-Control": "no-store" };

const parseDraftId = async (context: RouteContext): Promise<string> => {
  const { draftId } = await context.params;
  // Same 404 as an unknown draft, so the shape check reveals nothing.
  if (!isDraftId(draftId)) throw new ApiError({ kind: "not_found", backend: "mdrepo", code: "draft_not_found" });
  return draftId;
};

const tooLarge = (): ApiError => new ApiError({ kind: "http", backend: "mdrepo", status: 413, code: "too_large" });

// Content-Length is only a hint (absent for chunked bodies, forgeable), so the stream is counted and aborted at the limit.
const readLimitedText = async (request: Request): Promise<string> => {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) throw tooLarge();
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw tooLarge();
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
};

const fail = (error: unknown): Response => {
  if (!isApiError(error)) logger.error("draft route failed unexpectedly", { name: error instanceof Error ? error.name : typeof error });
  return problemResponse(error);
};

// Autosave (plan 4.3). Validates with the lenient schema on the server as well: the browser is never trusted.
const PUT = async (request: Request, context: RouteContext): Promise<Response> => {
  try {
    assertSameOrigin(request);
    const jar = await nextCookieJar();
    // Anonymous callers get 401 before any body parsing or validation answer.
    await requireSession(jar);
    const draftId = await parseDraftId(context);

    const raw = await readLimitedText(request);
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new ApiError({ kind: "http", backend: "mdrepo", status: 400, code: "bad_json" });
    }

    const body = bodySchema.safeParse(json);
    if (!body.success) throw new ApiError({ kind: "http", backend: "mdrepo", status: 400, code: "bad_body" });
    const draft = draftSchema.safeParse(body.data.draft);
    if (!draft.success) throw new ApiError({ kind: "validation", backend: "mdrepo", fieldErrors: toFieldErrors(draft.error.issues) });

    const saved = await saveDraft(jar, draftId, draft.data, body.data.revision);
    return Response.json(saved, { headers: noStore });
  } catch (error) {
    return fail(error);
  }
};

// Fresh server copy for "Load newer version" after a revision conflict.
const GET = async (request: Request, context: RouteContext): Promise<Response> => {
  try {
    assertSameOrigin(request);
    const draftId = await parseDraftId(context);
    return Response.json(await getDraft(await nextCookieJar(), draftId), { headers: noStore });
  } catch (error) {
    return fail(error);
  }
};

export { GET, PUT };
