import { roleFromName, type DetectedRole } from "../lib/fileRole";

type RejectReason = "too_large" | "type" | "duplicate" | "invalid_name";
type FailReason = "network" | "rejected" | "auth";
type ParseStatus = "ok" | "unreadable" | "unsupported";

type ParseSummary = {
  status: ParseStatus;
  // Field paths the parser filled in; the step decides how to merge the values (plan 4.4).
  fields: { path: string; value: unknown }[];
};

type UploadStatus =
  | "queued"
  | "initiating"
  | "uploading"
  | "committing"
  | "parsing"
  | "done"
  | "failed"
  | "interrupted"
  | "paused"
  | "removing"
  | "remove_failed"
  | "rejected";

type UploadItem = {
  id: string;
  // Upload key = file name (unique per draft).
  key: string;
  name: string;
  size: number;
  lastModified: number;
  status: UploadStatus;
  loaded: number;
  role: DetectedRole;
  failReason?: FailReason;
  rejectReason?: RejectReason;
  parse?: ParseSummary;
  // Set when the user re-selected a different file for an interrupted row.
  resumeMismatch?: boolean;
};

type UploadState = { items: UploadItem[] };

type FileMeta = { id: string; name: string; size: number; lastModified: number };
type DroppedFile = FileMeta & { rejectReason?: RejectReason };
type ServerFile = { key: string; size?: number; status: "pending" | "completed" };

type UploadAction =
  | { type: "dropped"; files: DroppedFile[] }
  | { type: "started"; id: string }
  | { type: "initiated"; id: string }
  | { type: "progress"; id: string; loaded: number }
  | { type: "uploaded"; id: string }
  | { type: "committed"; id: string }
  | { type: "parsed"; id: string; parse?: ParseSummary; role?: DetectedRole }
  | { type: "failed"; id: string; reason: FailReason }
  | { type: "retry"; id: string }
  | { type: "resumed"; id: string }
  | { type: "paused"; id: string }
  | { type: "unpaused"; id: string }
  | { type: "resume_mismatch"; id: string }
  | { type: "remove"; id: string }
  | { type: "removed"; id: string }
  | { type: "remove_failed"; id: string };

// Statuses that hold or wait for a queue slot: the file is not safely on the server yet.
// Paused rows count too: the bytes are not on the server yet.
const IN_FLIGHT: readonly UploadStatus[] = ["queued", "initiating", "uploading", "committing", "parsing", "paused"];

// Only work before the server-side commit can be paused; commit and parse are short and settle on their own.
const PAUSABLE: readonly UploadStatus[] = ["queued", "initiating", "uploading"];

const isInFlight = (item: UploadItem): boolean => IN_FLIGHT.includes(item.status);

const initialUploadState = (serverFiles: readonly ServerFile[] = []): UploadState => ({
  items: serverFiles.map((file) => ({
    id: `server:${file.key}`,
    key: file.key,
    name: file.key,
    size: file.size ?? 0,
    lastModified: 0,
    // Not committed before the reload: the browser file handle is gone, so the user has to select it again.
    status: file.status === "completed" ? "done" : "interrupted",
    loaded: file.status === "completed" ? (file.size ?? 0) : 0,
    role: roleFromName(file.key),
  })),
});

type Step = (item: UploadItem) => UploadItem | null;

const update = (state: UploadState, id: string, apply: Step): UploadState => {
  let changed = false;
  const items: UploadItem[] = [];
  for (const item of state.items) {
    if (item.id !== id) {
      items.push(item);
      continue;
    }
    const next = apply(item);
    if (next !== item) changed = true;
    if (next) items.push(next);
  }
  return changed ? { items } : state;
};

// Each transition names the only states it may start from; anything else is ignored (late events after a remove).
const from =
  (allowed: readonly UploadStatus[], next: Step): Step =>
  (item) =>
    allowed.includes(item.status) ? next(item) : item;

const without = (item: UploadItem, ...keys: (keyof UploadItem)[]): UploadItem => {
  const copy = { ...item };
  for (const key of keys) delete copy[key];
  return copy;
};

const uploadReducer = (state: UploadState, action: UploadAction): UploadState => {
  switch (action.type) {
    case "dropped": {
      // Rejected rows only live until the next drop (missing-states 3.5).
      const kept = state.items.filter((item) => item.status !== "rejected");
      const known = new Set(kept.map((item) => item.key));
      const rejected: UploadItem[] = [];
      const accepted: UploadItem[] = [];
      for (const file of action.files) {
        const rejectReason = file.rejectReason ?? (known.has(file.name) ? "duplicate" : undefined);
        if (!rejectReason) known.add(file.name);
        const item: UploadItem = {
          id: file.id,
          key: file.name,
          name: file.name,
          size: file.size,
          lastModified: file.lastModified,
          status: rejectReason ? "rejected" : "queued",
          loaded: 0,
          role: roleFromName(file.name),
          ...(rejectReason && { rejectReason }),
        };
        (rejectReason ? rejected : accepted).push(item);
      }
      return { items: [...rejected, ...kept, ...accepted] };
    }
    case "started":
      return update(state, action.id, from(["queued"], (item) => ({ ...item, status: "initiating", loaded: 0 })));
    case "initiated":
      return update(state, action.id, from(["initiating"], (item) => ({ ...item, status: "uploading" })));
    case "progress":
      return update(
        state,
        action.id,
        from(["uploading"], (item) => ({ ...item, loaded: Math.min(Math.max(action.loaded, item.loaded), item.size) })),
      );
    case "uploaded":
      return update(state, action.id, from(["uploading"], (item) => ({ ...item, status: "committing", loaded: item.size })));
    case "committed":
      return update(state, action.id, from(["committing"], (item) => ({ ...item, status: "parsing" })));
    case "parsed":
      return update(
        state,
        action.id,
        from(["parsing"], (item) => ({
          ...item,
          status: "done",
          ...(action.parse && { parse: action.parse }),
          ...(action.role && { role: action.role }),
        })),
      );
    case "failed":
      return update(
        state,
        action.id,
        from(["initiating", "uploading", "committing"], (item) => ({
          ...item,
          // A 401 after refresh means the session is gone; the upload URL is session-bound (missing-states 3.5).
          status: action.reason === "auth" ? "interrupted" : "failed",
          failReason: action.reason,
          loaded: 0,
        })),
      );
    case "retry":
      return update(
        state,
        action.id,
        from(["failed"], (item) => ({ ...without(item, "failReason"), status: "queued", loaded: 0 })),
      );
    case "resumed":
      return update(
        state,
        action.id,
        from(["interrupted"], (item) => ({ ...without(item, "failReason", "resumeMismatch"), status: "queued", loaded: 0 })),
      );
    case "paused":
      return update(state, action.id, from(PAUSABLE, (item) => ({ ...item, status: "paused", loaded: 0 })));
    case "unpaused":
      return update(state, action.id, from(["paused"], (item) => ({ ...item, status: "queued", loaded: 0 })));
    case "resume_mismatch":
      return update(state, action.id, from(["interrupted"], (item) => ({ ...item, resumeMismatch: true })));
    case "remove":
      // Done files need a server-side delete; everything else is only local (the queue aborts in-flight work).
      return update(state, action.id, (item) => {
        if (item.status === "removing") return item;
        if (item.status === "done" || item.status === "remove_failed") return { ...item, status: "removing" };
        return null;
      });
    case "removed":
      return update(state, action.id, from(["removing"], () => null));
    case "remove_failed":
      return update(state, action.id, from(["removing"], (item) => ({ ...item, status: "remove_failed" })));
  }
};

type UploadSummary = { total: number; uploaded: number; failed: number; interrupted: number; paused: number; inFlight: number };

const summarize = (state: UploadState): UploadSummary => {
  const counted = state.items.filter((item) => item.status !== "rejected");
  return {
    total: counted.length,
    uploaded: counted.filter((item) => item.status === "done").length,
    failed: counted.filter((item) => item.status === "failed").length,
    interrupted: counted.filter((item) => item.status === "interrupted").length,
    paused: counted.filter((item) => item.status === "paused").length,
    inFlight: counted.filter(isInFlight).length,
  };
};

export { initialUploadState, isInFlight, summarize, uploadReducer };
export type {
  DroppedFile,
  FailReason,
  FileMeta,
  ParseStatus,
  ParseSummary,
  RejectReason,
  ServerFile,
  UploadAction,
  UploadItem,
  UploadState,
  UploadStatus,
  UploadSummary,
};
