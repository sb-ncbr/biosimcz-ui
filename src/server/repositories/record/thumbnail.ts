import "server-only";
import { isApiError } from "../../http/errors";
import { getScreenshot } from "../../backends/mdposit/client";

const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024;
const THUMBNAIL_TIMEOUT_MS = 8000;

type Thumbnail = { bytes: Uint8Array; contentType: string };

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0): boolean =>
  signature.every((value, index) => bytes[offset + index] === value);

// The live MDposit file host labels screenshots application/octet-stream, so the type is decided by the magic bytes.
// SVG is never accepted (scripts).
const sniffImageType = (bytes: Uint8Array): string | null => {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return "image/gif";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
};

// Reads at most the cap; null when the body is larger.
const readCapped = async (response: Response): Promise<Uint8Array | null> => {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_THUMBNAIL_BYTES || !response.body) return declared > MAX_THUMBNAIL_BYTES ? null : new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_THUMBNAIL_BYTES) {
      void reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
};

// null = no usable image (missing, not an image, too large). Network and 5xx failures throw an ApiError.
const getRecordThumbnail = async (id: string): Promise<Thumbnail | null> => {
  let response: Response;
  try {
    response = await getScreenshot(id, THUMBNAIL_TIMEOUT_MS);
  } catch (error) {
    if (isApiError(error) && error.kind === "not_found") return null;
    throw error;
  }
  const declared = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (declared !== "" && !declared.startsWith("image/") && declared !== "application/octet-stream") {
    void response.body?.cancel().catch(() => undefined);
    return null;
  }
  const bytes = await readCapped(response);
  if (bytes === null || bytes.byteLength === 0) return null;
  const contentType = sniffImageType(bytes);
  return contentType === null ? null : { bytes, contentType };
};

export { getRecordThumbnail, MAX_THUMBNAIL_BYTES };
export type { Thumbnail };
