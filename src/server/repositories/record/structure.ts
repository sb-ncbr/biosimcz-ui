import "server-only";
import { openStructure } from "../../backends/mdposit/client";
import { isApiError } from "../../http/errors";
import { capStream, forwardableLength, mediaType, tooLarge, type StreamDeadlines } from "../../lib/capStream";

const MAX_STRUCTURE_BYTES = 50 * 1024 * 1024;
const STRUCTURE_TIMEOUT_MS = 30_000;
const STRUCTURE_DEADLINES: StreamDeadlines = { idleMs: 60_000, totalMs: 5 * 60_000 };

type StructureStream = { body: ReadableStream<Uint8Array>; contentType: string; contentLength: string | null };

// The live host labels the PDB chemical/x-pdb; text/plain is accepted for older servers. Anything else (HTML error pages) is refused.
const ALLOWED_TYPES = new Set(["chemical/x-pdb", "chemical/x-cif", "text/plain", "application/octet-stream"]);

// null = no structure upstream (404). Network and 5xx failures throw an ApiError.
const getRecordStructure = async (id: string, selection?: string): Promise<StructureStream | null> => {
  let response: Response;
  try {
    response = await openStructure(id, selection, STRUCTURE_TIMEOUT_MS);
  } catch (error) {
    if (isApiError(error) && error.kind === "not_found") return null;
    throw error;
  }
  const declared = mediaType(response);
  const discard = () => void response.body?.cancel().catch(() => undefined);
  if (declared !== "" && !ALLOWED_TYPES.has(declared)) {
    discard();
    return null;
  }
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null && Number(declaredLength) > MAX_STRUCTURE_BYTES) {
    discard();
    throw tooLarge();
  }
  if (!response.body) return null;
  return { body: response.body.pipeThrough(capStream(MAX_STRUCTURE_BYTES, STRUCTURE_DEADLINES)), contentType: "chemical/x-pdb", contentLength: forwardableLength(response) };
};

export { getRecordStructure, MAX_STRUCTURE_BYTES };
export type { StructureStream };
