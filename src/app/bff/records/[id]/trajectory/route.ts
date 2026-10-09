import { isInstanceId } from "@/entities/replica/lib/replicaRef";
import { trajectoryRequestSchema } from "@/entities/replica/model/trajectory";
import { ApiError, isApiError, problemResponse } from "@/server/http/errors";
import { validationError } from "@/server/http/queryValidation";
import { createConcurrencyLimiter, releaseWhenDone } from "@/server/lib/concurrencyLimit";
import { logger } from "@/server/lib/logger";
import { openTrajectoryStream } from "@/server/repositories/replica/streams";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const CACHE_MISSING = "public, max-age=300";

const notFound = (): Response => new Response(null, { status: 404, headers: { "Cache-Control": CACHE_MISSING } });

const MAX_CONCURRENT_STREAMS = 4;
const RETRY_AFTER_SECONDS = "5";
const limiter = createConcurrencyLimiter(MAX_CONCURRENT_STREAMS);

const tooManyStreams = (): Response => {
  const problem = problemResponse(
    new ApiError({ kind: "http", backend: "mdposit", status: 429, code: "too_many_streams", messageKey: "errors.http.too_many_streams" }),
  );
  return new Response(problem.body, { status: 429, headers: { ...Object.fromEntries(problem.headers), "Retry-After": RETRY_AFTER_SECONDS } });
};

// A blank parameter means "not set", so a form that submits an empty field behaves like no field.
const optionalParam = (params: URLSearchParams, key: string): string | undefined => {
  const value = params.get(key);
  return value === null || value === "" ? undefined : value;
};

// Public and anonymous: trajectories are published MDposit data. GET only. The request signal reaches the upstream fetch, so a
// cancelled browser download stops the upstream transfer. no-store: payloads are large and a re-download is an explicit action.
const GET = async (request: Request, context: RouteContext): Promise<Response> => {
  const { id } = await context.params;
  if (!isInstanceId(id)) return notFound();
  try {
    const params = new URL(request.url).searchParams;
    const query = trajectoryRequestSchema.safeParse({ frames: optionalParam(params, "frames"), selection: optionalParam(params, "selection") });
    if (!query.success) return problemResponse(validationError(query.error));
    const release = limiter.tryAcquire();
    if (!release) return tooManyStreams();
    // Abort also covers the window before the body exists; release is idempotent.
    request.signal.addEventListener("abort", release, { once: true });
    const free = () => {
      request.signal.removeEventListener("abort", release);
      release();
    };
    let trajectory: Awaited<ReturnType<typeof openTrajectoryStream>>;
    try {
      trajectory = await openTrajectoryStream(id, query.data, request.signal);
    } catch (error) {
      free();
      throw error;
    }
    if (!trajectory) {
      free();
      return notFound();
    }
    const headers: Record<string, string> = {
      "Content-Type": trajectory.contentType,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    };
    if (trajectory.contentLength !== null) headers["Content-Length"] = trajectory.contentLength;
    return new Response(releaseWhenDone(trajectory.body, free), { headers });
  } catch (error) {
    if (!isApiError(error)) logger.error("trajectory route failed unexpectedly", { name: error instanceof Error ? error.name : typeof error });
    return problemResponse(error);
  }
};

export { GET };
