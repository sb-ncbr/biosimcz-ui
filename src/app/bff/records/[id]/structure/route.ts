import { z } from "zod";
import { isRecordId } from "@/entities/record/lib/recordId";
import { selectionSchema } from "@/entities/replica/model/trajectory";
import { ApiError, isApiError, problemResponse } from "@/server/http/errors";
import { validationError } from "@/server/http/queryValidation";
import { createConcurrencyLimiter, releaseWhenDone } from "@/server/lib/concurrencyLimit";
import { logger } from "@/server/lib/logger";
import { getRecordStructure } from "@/server/repositories/record/structure";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const querySchema = z.object({ selection: selectionSchema.optional() });

const CACHE_OK = "public, max-age=86400, stale-while-revalidate=604800";
const CACHE_MISSING = "public, max-age=300";

const notFound = (): Response => new Response(null, { status: 404, headers: { "Cache-Control": CACHE_MISSING } });

// Only selection requests bypass the public cache, so only they can fan out unbounded upstream work.
const MAX_CONCURRENT_SELECTIONS = 16;
const RETRY_AFTER_SECONDS = "5";
const selectionLimiter = createConcurrencyLimiter(MAX_CONCURRENT_SELECTIONS);

const tooManyRequests = (): Response => {
  const problem = problemResponse(
    new ApiError({ kind: "http", backend: "mdposit", status: 429, code: "too_many_streams", messageKey: "errors.http.too_many_streams" }),
  );
  return new Response(problem.body, { status: 429, headers: { ...Object.fromEntries(problem.headers), "Retry-After": RETRY_AFTER_SECONDS } });
};

// Public and anonymous: structures are published MDposit data. GET only (no other method is exported).
const GET = async (request: Request, context: RouteContext): Promise<Response> => {
  const { id } = await context.params;
  if (!isRecordId(id)) return notFound();
  try {
    const query = querySchema.safeParse({ selection: new URL(request.url).searchParams.get("selection") ?? undefined });
    if (!query.success) return problemResponse(validationError(query.error));
    const selection = query.data.selection || undefined;
    const release = selection ? selectionLimiter.tryAcquire() : null;
    if (selection && !release) return tooManyRequests();
    const free = () => {
      request.signal.removeEventListener("abort", free);
      release?.();
    };
    // Abort also covers the window before the body exists; release is idempotent.
    if (release) request.signal.addEventListener("abort", free, { once: true });
    let structure: Awaited<ReturnType<typeof getRecordStructure>>;
    try {
      structure = await getRecordStructure(id, selection);
    } catch (error) {
      free();
      throw error;
    }
    if (!structure) {
      free();
      return notFound();
    }
    const headers: Record<string, string> = {
      "Content-Type": structure.contentType,
      "Cache-Control": CACHE_OK,
      "X-Content-Type-Options": "nosniff",
    };
    if (structure.contentLength !== null) headers["Content-Length"] = structure.contentLength;
    return new Response(release ? releaseWhenDone(structure.body, free) : structure.body, { headers });
  } catch (error) {
    if (!isApiError(error)) logger.error("structure route failed unexpectedly", { name: error instanceof Error ? error.name : typeof error });
    return problemResponse(error);
  }
};

export { GET };
