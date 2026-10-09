import { isRecordId } from "@/entities/record/lib/recordId";
import { isApiError, problemResponse } from "@/server/http/errors";
import { logger } from "@/server/lib/logger";
import { getRecordThumbnail } from "@/server/repositories/record/thumbnail";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const CACHE_OK = "public, max-age=86400, stale-while-revalidate=604800";
// A missing image is cached briefly so a list of records without screenshots does not hit MDposit on every view.
const CACHE_MISSING = "public, max-age=300";

const notFound = (): Response => new Response(null, { status: 404, headers: { "Cache-Control": CACHE_MISSING } });

// Public and anonymous: the screenshots are published MDposit data. GET only (no other method is exported).
const GET = async (_request: Request, context: RouteContext): Promise<Response> => {
  const { id } = await context.params;
  if (!isRecordId(id)) return notFound();
  try {
    const thumbnail = await getRecordThumbnail(id);
    if (!thumbnail) return notFound();
    return new Response(Buffer.from(thumbnail.bytes), {
      headers: {
        "Content-Type": thumbnail.contentType,
        "Content-Length": String(thumbnail.bytes.byteLength),
        "Cache-Control": CACHE_OK,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (!isApiError(error))
      logger.error("thumbnail route failed unexpectedly", { name: error instanceof Error ? error.name : typeof error });
    return problemResponse(error);
  }
};

export { GET };
