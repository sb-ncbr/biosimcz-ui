import { fileKeyProblem } from "./keys";
import type { RejectReason } from "../model/uploadMachine";

type FileLike = { name: string; size: number };

// Client-side pre-check; the BFF repeats it and is the authority.
const rejectionFor = (file: FileLike, accept: readonly string[], maxBytes: number): RejectReason | undefined => {
  const problem = fileKeyProblem(file.name, accept);
  if (problem === "extension") return "type";
  if (problem !== null) return "invalid_name";
  if (file.size > maxBytes) return "too_large";
  return undefined;
};

export { rejectionFor };
