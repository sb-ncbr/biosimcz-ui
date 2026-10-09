import type { BffError } from "@/shared/lib";

const MESSAGES: Record<string, string> = {
  "errors.validation.trajectory_rejected": "The server could not read this frame window or selection. Check both and try again.",
  "errors.validation": "The request was not accepted. Check the frame window and the selection.",
  "errors.http.too_many_streams": "The server is busy with other trajectory downloads.",
  "errors.http.too_large": "This request is too large to download. Narrow the frame window or add a stride.",
  "errors.download.too_large": "This trajectory is larger than 512 MiB and cannot be downloaded in the browser. Narrow the frame window or add a stride.",
  "errors.http.bad_content_type": "The server returned data that is not a trajectory.",
  "errors.not_found": "This replica has no trajectory to download.",
  "errors.timeout": "The server took too long to answer.",
  "errors.network": "The connection failed. Check your network and try again.",
};

const FALLBACK_MESSAGE = "The trajectory could not be downloaded.";

// Prose comes from here, never from the response: the BFF only sends keys.
const problemMessage = (problem: BffError, retryAfterSeconds: number | null = null): string => {
  if (problem.messageKey === "errors.http.too_many_streams") {
    const base = MESSAGES[problem.messageKey] ?? FALLBACK_MESSAGE;
    return retryAfterSeconds === null ? `${base} Try again in a moment.` : `${base} Try again in ${retryAfterSeconds} seconds.`;
  }
  if (problem.status === 413) return MESSAGES["errors.http.too_large"] ?? FALLBACK_MESSAGE;
  return MESSAGES[problem.messageKey] ?? FALLBACK_MESSAGE;
};

export { problemMessage };
