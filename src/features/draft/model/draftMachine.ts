// Draft lifecycle as a typed reducer (plan 4.2, decision D5). Every failure is a named state with a way out.
// The reducer is pure: timers, requests and IndexedDB live in useAutosave and DraftProvider, which feed it events.

type DraftStatus =
  | "creating"
  | "create-failed"
  | "editing"
  | "dirty"
  | "saving"
  | "save-failed"
  | "conflict"
  | "session-expired"
  | "publishing"
  | "published"
  | "publish-failed"
  | "deleting"
  | "deleted";

type DraftState = {
  status: DraftStatus;
  // Server revision the next save is based on (optimistic concurrency).
  revision: number;
  lastSavedAt: number | null;
  // Bumped by every change so the debounce restarts even while the status stays "dirty".
  changes: number;
  // A change arrived while a request was in flight; it is sent by the next save (one request at a time, latest wins).
  pendingChange: boolean;
  // Local values differ from the server copy.
  unsaved: boolean;
  // Consecutive failed attempts; drives the backoff and the "retrying" versus "failed" copy.
  failures: number;
  offline: boolean;
  // Machine code of the last failure ("network", "http", "validation", a backend code), for the Details collapsible.
  errorCode: string | null;
};

type DraftEvent =
  | { type: "CHANGE" }
  | { type: "SAVE_STARTED" }
  | { type: "SAVE_SUCCEEDED"; revision: number; at: number }
  | { type: "SAVE_FAILED"; code?: string }
  | { type: "SAVE_CONFLICT" }
  | { type: "SESSION_EXPIRED" }
  | { type: "SESSION_RESTORED" }
  // Conflict resolved by loading the newer server copy.
  | { type: "RELOAD_SERVER"; revision: number; at: number }
  // Conflict resolved by keeping the local values on top of the current server revision.
  | { type: "KEEP_MINE"; revision: number }
  | { type: "RETRY_NOW" }
  | { type: "OFFLINE" }
  | { type: "ONLINE" }
  | { type: "PUBLISH_STARTED" }
  | { type: "PUBLISH_SUCCEEDED" }
  | { type: "PUBLISH_FAILED"; code?: string }
  | { type: "PUBLISH_DISMISSED" }
  | { type: "DELETE_STARTED" }
  | { type: "DELETE_SUCCEEDED" }
  | { type: "DELETE_FAILED" }
  | { type: "CREATE_STARTED" }
  | { type: "CREATE_SUCCEEDED"; revision: number; at: number }
  | { type: "CREATE_FAILED"; code?: string };

const createInitialState = (init: { revision: number; savedAt: number | null }): DraftState => ({
  status: "editing",
  revision: init.revision,
  lastSavedAt: init.savedAt,
  changes: 0,
  pendingChange: false,
  unsaved: false,
  failures: 0,
  offline: false,
  errorCode: null,
});

// The state before a draft exists: "New Deposition" is in flight.
const creatingState = (): DraftState => ({ ...createInitialState({ revision: 0, savedAt: null }), status: "creating" });

const EDITABLE: readonly DraftStatus[] = ["editing", "dirty", "saving", "save-failed", "conflict", "session-expired"];

const draftReducer = (state: DraftState, event: DraftEvent): DraftState => {
  switch (event.type) {
    case "CHANGE": {
      if (!EDITABLE.includes(state.status)) return state;
      const next = { ...state, changes: state.changes + 1, unsaved: true };
      if (state.status === "editing") return { ...next, status: "dirty" };
      if (state.status === "saving") return { ...next, pendingChange: true };
      // dirty stays dirty; save-failed, conflict and session-expired keep their state and only remember the change.
      return next;
    }
    case "SAVE_STARTED":
      if (state.status !== "dirty" && state.status !== "save-failed") return state;
      return { ...state, status: "saving", pendingChange: false };
    case "SAVE_SUCCEEDED":
      if (state.status !== "saving") return state;
      return {
        ...state,
        status: state.pendingChange ? "dirty" : "editing",
        revision: event.revision,
        lastSavedAt: event.at,
        pendingChange: false,
        unsaved: state.pendingChange,
        failures: 0,
        errorCode: null,
      };
    case "SAVE_FAILED":
      if (state.status !== "saving") return state;
      return { ...state, status: "save-failed", failures: state.failures + 1, errorCode: event.code ?? "unknown" };
    case "SAVE_CONFLICT":
      if (state.status !== "saving") return state;
      return { ...state, status: "conflict", errorCode: "conflict" };
    case "SESSION_EXPIRED":
      if (state.status === "publishing") return { ...state, status: "session-expired", errorCode: "session_expired" };
      if (state.status !== "saving" && state.status !== "dirty" && state.status !== "save-failed") return state;
      return { ...state, status: "session-expired", errorCode: "session_expired" };
    case "SESSION_RESTORED":
      if (state.status !== "session-expired") return state;
      return { ...state, status: state.unsaved ? "dirty" : "editing", errorCode: null, failures: 0, changes: state.changes + 1 };
    case "RELOAD_SERVER":
      if (state.status !== "conflict") return state;
      return { ...state, status: "editing", revision: event.revision, lastSavedAt: event.at, unsaved: false, pendingChange: false, failures: 0, errorCode: null };
    case "KEEP_MINE":
      if (state.status !== "conflict") return state;
      return { ...state, status: "dirty", revision: event.revision, failures: 0, errorCode: null, changes: state.changes + 1 };
    case "RETRY_NOW":
      if (state.status !== "save-failed") return state;
      return { ...state, failures: 0 };
    case "OFFLINE":
      return { ...state, offline: true };
    case "ONLINE":
      return { ...state, offline: false, failures: 0 };
    case "PUBLISH_STARTED":
      return state.status === "editing" ? { ...state, status: "publishing" } : state;
    case "PUBLISH_SUCCEEDED":
      return state.status === "publishing" ? { ...state, status: "published" } : state;
    case "PUBLISH_FAILED":
      return state.status === "publishing" ? { ...state, status: "publish-failed", errorCode: event.code ?? "unknown" } : state;
    case "PUBLISH_DISMISSED":
      return state.status === "publish-failed" ? { ...state, status: "editing", errorCode: null } : state;
    case "DELETE_STARTED":
      return state.status === "editing" ? { ...state, status: "deleting" } : state;
    case "DELETE_SUCCEEDED":
      return state.status === "deleting" ? { ...state, status: "deleted" } : state;
    case "DELETE_FAILED":
      return state.status === "deleting" ? { ...state, status: "editing" } : state;
    case "CREATE_STARTED":
      return state.status === "create-failed" || state.status === "creating" ? { ...state, status: "creating", errorCode: null } : state;
    case "CREATE_SUCCEEDED":
      return state.status === "creating" ? { ...createInitialState({ revision: event.revision, savedAt: event.at }), offline: state.offline } : state;
    case "CREATE_FAILED":
      return state.status === "creating" ? { ...state, status: "create-failed", errorCode: event.code ?? "unknown" } : state;
  }
};

// True while the wizard must not lose local values on navigation (leave warning, pagehide flush).
const hasUnsavedChanges = (state: DraftState): boolean => state.unsaved;

export { createInitialState, creatingState, draftReducer, hasUnsavedChanges };
export type { DraftEvent, DraftState, DraftStatus };
