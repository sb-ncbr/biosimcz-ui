import { isAnalysisName } from "@/entities/analysis/model/names";
import { isInstanceId } from "@/entities/replica/lib/replicaRef";
import { isApiError, problemResponse } from "@/server/http/errors";
import { logger } from "@/server/lib/logger";
import { openAnalysisStream } from "@/server/repositories/replica/streams";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; name: string }> };

const CACHE_OK = "public, max-age=3600, stale-while-revalidate=86400";
const CACHE_MISSING = "public, max-age=300";

const notFound = (): Response => new Response(null, { status: 404, headers: { "Cache-Control": CACHE_MISSING } });

// Public and anonymous: analyses are published MDposit data. The body is relayed unparsed; the browser validates the shape.
// GET only (no other method is exported).
const GET = async (request: Request, context: RouteContext): Promise<Response> => {
  const { id, name } = await context.params;
  if (!isInstanceId(id) || !isAnalysisName(name)) return notFound();
  try {
    const analysis = await openAnalysisStream(id, name, request.signal);
    if (!analysis) return notFound();
    const headers: Record<string, string> = {
      "Content-Type": analysis.contentType,
      "Cache-Control": CACHE_OK,
      "X-Content-Type-Options": "nosniff",
    };
    if (analysis.contentLength !== null) headers["Content-Length"] = analysis.contentLength;
    return new Response(analysis.body, { headers });
  } catch (error) {
    if (!isApiError(error)) logger.error("analysis route failed unexpectedly", { name: error instanceof Error ? error.name : typeof error });
    return problemResponse(error);
  }
};

export { GET };
