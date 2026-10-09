import { toDetectedRole } from "../lib/fileRole";
import type { FailReason, UploadAction } from "./uploadMachine";
import { TransportFailure, type UploadTransport } from "./xhrTransport";

type UploadJob = { id: string; draftId: string; key: string; file: Blob };

const reasonFor = (error: unknown): FailReason => {
  if (!(error instanceof TransportFailure)) return "network";
  if (error.status === 401) return "auth";
  // 413/415/422 and other 4xx: retrying the same bytes cannot help. 408 and 409 (BFF: stream not replayable) can.
  if (error.status !== undefined && error.status >= 400 && error.status < 500 && error.status !== 409 && error.status !== 408) {
    return "rejected";
  }
  return "network";
};

// One file through init, content, commit, parse. Every failure becomes one `failed` action; an abort
// (remove or unmount) dispatches nothing because the item is already gone.
const runUpload = async (
  job: UploadJob,
  transport: UploadTransport,
  emit: (action: UploadAction) => void,
  signal: AbortSignal,
): Promise<void> => {
  const { id, draftId, key, file } = job;

  emit({ type: "started", id });
  try {
    await transport.init(draftId, key, signal);
    if (signal.aborted) return;
    emit({ type: "initiated", id });
    await transport.putContent(draftId, key, file, { signal, onProgress: (loaded) => emit({ type: "progress", id, loaded }) });
    if (signal.aborted) return;
    emit({ type: "uploaded", id });
    await transport.commit(draftId, key, signal);
    if (signal.aborted) return;
    emit({ type: "committed", id });
  } catch (error) {
    if (signal.aborted || (error instanceof TransportFailure && error.kind === "aborted")) return;
    emit({ type: "failed", id, reason: reasonFor(error) });
    return;
  }

  // The file is safely stored from here on: a parse problem never fails the upload.
  try {
    const parsed = await transport.parse(draftId, key, signal);
    if (signal.aborted) return;
    const role = toDetectedRole(parsed.detectedRole);
    emit({ type: "parsed", id, parse: { status: parsed.status, fields: parsed.fields }, ...(role && { role }) });
  } catch {
    if (!signal.aborted) emit({ type: "parsed", id });
  }
};

export { reasonFor, runUpload };
export type { UploadJob };
