import "server-only";
import { openAnalysis, openTrajectory, TRAJECTORY_TIMEOUT_MS } from "../../backends/mdposit/client";
import { ApiError, isApiError } from "../../http/errors";
import { capStream, forwardableLength, mediaType, tooLarge, type StreamDeadlines } from "../../lib/capStream";

const MAX_ANALYSIS_BYTES = 16 * 1024 * 1024;
const MAX_TRAJECTORY_BYTES = 1024 * 1024 * 1024;
const ANALYSIS_TIMEOUT_MS = 30_000;
const STREAM_IDLE_MS = 60_000;
const ANALYSIS_DEADLINES: StreamDeadlines = { idleMs: STREAM_IDLE_MS, totalMs: 5 * 60_000 };
const TRAJECTORY_DEADLINES: StreamDeadlines = { idleMs: STREAM_IDLE_MS, totalMs: TRAJECTORY_TIMEOUT_MS };

const JSON_TYPES: ReadonlySet<string> = new Set(["application/json"]);
// The live XTC content type is not documented; tolerate the usual binary labels. HTML and JSON error pages stay refused.
const TRAJECTORY_TYPES: ReadonlySet<string> = new Set([
  "application/octet-stream",
  "application/x-gzip",
  "application/gzip",
  "application/zip",
  "application/x-xtc",
  "chemical/x-xtc",
  "binary/octet-stream",
]);

type UpstreamStream = { body: ReadableStream<Uint8Array>; contentType: string; contentLength: string | null };
type TrajectoryQuery = { frames?: string; selection?: string };

const badContentType = (): ApiError => new ApiError({ kind: "http", backend: "mdposit", status: 502, code: "bad_content_type" });

const discard = (response: Response): void => void response.body?.cancel().catch(() => undefined);

// Checks the type and declared size, then caps the live byte count. A missing content type is accepted.
const relay = (
  response: Response,
  allowed: ReadonlySet<string>,
  contentType: string,
  limit: number,
  deadlines: StreamDeadlines,
): UpstreamStream | null => {
  const declared = mediaType(response);
  if (declared !== "" && !allowed.has(declared)) {
    discard(response);
    throw badContentType();
  }
  const length = response.headers.get("content-length");
  if (length !== null && Number(length) > limit) {
    discard(response);
    throw tooLarge();
  }
  if (!response.body) return null;
  return { body: response.body.pipeThrough(capStream(limit, deadlines)), contentType, contentLength: forwardableLength(response) };
};

// null = no such analysis upstream. The body is relayed unparsed; the browser validates it.
const openAnalysisStream = async (instanceId: string, name: string, signal?: AbortSignal): Promise<UpstreamStream | null> => {
  try {
    return relay(await openAnalysis(instanceId, name, signal, ANALYSIS_TIMEOUT_MS), JSON_TYPES, "application/json", MAX_ANALYSIS_BYTES, ANALYSIS_DEADLINES);
  } catch (error) {
    if (isApiError(error) && error.kind === "not_found") return null;
    throw error;
  }
};

// null = no trajectory upstream. Upstream text for a rejected range or selection is never relayed: the route answers with our
// own 422 code.
const openTrajectoryStream = async (instanceId: string, query: TrajectoryQuery, signal: AbortSignal): Promise<UpstreamStream | null> => {
  try {
    const response = await openTrajectory(instanceId, { format: "xtc", ...query }, signal);
    return relay(response, TRAJECTORY_TYPES, "application/octet-stream", MAX_TRAJECTORY_BYTES, TRAJECTORY_DEADLINES);
  } catch (error) {
    if (!isApiError(error)) throw error;
    if (error.kind === "not_found") return null;
    if (error.kind === "validation" && error.status === 400) {
      throw new ApiError({
        kind: "validation",
        backend: "mdposit",
        status: 422,
        code: "trajectory_rejected",
        messageKey: "errors.validation.trajectory_rejected",
      });
    }
    throw error;
  }
};

export { MAX_ANALYSIS_BYTES, openAnalysisStream, openTrajectoryStream };
