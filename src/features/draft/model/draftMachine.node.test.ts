import { describe, expect, it } from "vitest";
import { createInitialState, creatingState, draftReducer, hasUnsavedChanges, type DraftEvent, type DraftState, type DraftStatus } from "./draftMachine";

const base = createInitialState({ revision: 3, savedAt: 1000 });
const inStatus = (status: DraftStatus, patch: Partial<DraftState> = {}): DraftState => ({ ...base, status, ...patch });
const run = (state: DraftState, ...events: DraftEvent[]): DraftState => events.reduce(draftReducer, state);

describe("draftMachine: editing and saving", () => {
  it("starts in editing with nothing unsaved", () => {
    expect(base).toMatchObject({ status: "editing", revision: 3, unsaved: false, failures: 0 });
    expect(hasUnsavedChanges(base)).toBe(false);
  });

  it("Editing -> Dirty on change; more changes stay Dirty and restart the debounce", () => {
    const dirty = run(base, { type: "CHANGE" });
    expect(dirty).toMatchObject({ status: "dirty", unsaved: true, changes: 1 });
    expect(run(dirty, { type: "CHANGE" })).toMatchObject({ status: "dirty", changes: 2 });
  });

  it("Dirty -> Saving -> Editing on success, recording revision and time, clearing unsaved", () => {
    const saved = run(base, { type: "CHANGE" }, { type: "SAVE_STARTED" }, { type: "SAVE_SUCCEEDED", revision: 4, at: 2000 });
    expect(saved).toMatchObject({ status: "editing", revision: 4, lastSavedAt: 2000, unsaved: false, failures: 0, errorCode: null });
  });

  it("Saving -> Dirty when a change arrived during the request (one request in flight, latest wins)", () => {
    const saving = run(base, { type: "CHANGE" }, { type: "SAVE_STARTED" });
    expect(saving.status).toBe("saving");
    const changed = run(saving, { type: "CHANGE" });
    expect(changed).toMatchObject({ status: "saving", pendingChange: true });
    const after = run(changed, { type: "SAVE_SUCCEEDED", revision: 4, at: 2000 });
    expect(after).toMatchObject({ status: "dirty", revision: 4, unsaved: true, pendingChange: false });
    expect(run(after, { type: "SAVE_STARTED" }).status).toBe("saving");
  });

  it("ignores SAVE_STARTED unless dirty or save-failed, and results unless saving", () => {
    expect(run(base, { type: "SAVE_STARTED" })).toBe(base);
    expect(run(base, { type: "SAVE_SUCCEEDED", revision: 9, at: 1 })).toBe(base);
    expect(run(base, { type: "SAVE_FAILED" })).toBe(base);
    expect(run(base, { type: "SAVE_CONFLICT" })).toBe(base);
  });
});

describe("draftMachine: failures", () => {
  const failed = run(base, { type: "CHANGE" }, { type: "SAVE_STARTED" }, { type: "SAVE_FAILED", code: "network" });

  it("Saving -> SaveFailed counts failures and keeps the code", () => {
    expect(failed).toMatchObject({ status: "save-failed", failures: 1, errorCode: "network", unsaved: true });
    expect(run(failed, { type: "SAVE_STARTED" }, { type: "SAVE_FAILED" })).toMatchObject({ status: "save-failed", failures: 2, errorCode: "unknown" });
  });

  it("SaveFailed -> Saving (auto or manual retry) -> Editing on success resets the counters", () => {
    const retried = run(failed, { type: "SAVE_STARTED" }, { type: "SAVE_SUCCEEDED", revision: 4, at: 5 });
    expect(retried).toMatchObject({ status: "editing", failures: 0, errorCode: null, unsaved: false });
  });

  it("RETRY_NOW zeroes the backoff without leaving SaveFailed; changes are remembered but do not change state", () => {
    expect(run(failed, { type: "RETRY_NOW" })).toMatchObject({ status: "save-failed", failures: 0 });
    expect(run(failed, { type: "CHANGE" })).toMatchObject({ status: "save-failed", changes: failed.changes + 1 });
    expect(run(base, { type: "RETRY_NOW" })).toBe(base);
  });

  it("Saving -> Conflict; reload returns to Editing with the server revision, keep-mine returns to Dirty", () => {
    const conflict = run(base, { type: "CHANGE" }, { type: "SAVE_STARTED" }, { type: "SAVE_CONFLICT" });
    expect(conflict).toMatchObject({ status: "conflict", errorCode: "conflict" });
    expect(run(conflict, { type: "CHANGE" }).status).toBe("conflict");
    expect(run(conflict, { type: "RELOAD_SERVER", revision: 9, at: 77 })).toMatchObject({ status: "editing", revision: 9, lastSavedAt: 77, unsaved: false });
    expect(run(conflict, { type: "KEEP_MINE", revision: 9 })).toMatchObject({ status: "dirty", revision: 9, unsaved: true });
    expect(run(base, { type: "RELOAD_SERVER", revision: 9, at: 1 })).toBe(base);
    expect(run(base, { type: "KEEP_MINE", revision: 9 })).toBe(base);
  });

  it("session expiry from saving, dirty or save-failed; restored goes back to Dirty (mirror re-sent) or Editing", () => {
    const saving = run(base, { type: "CHANGE" }, { type: "SAVE_STARTED" });
    for (const from of [saving, run(base, { type: "CHANGE" }), failed]) {
      expect(run(from, { type: "SESSION_EXPIRED" })).toMatchObject({ status: "session-expired", errorCode: "session_expired" });
    }
    const expired = run(saving, { type: "SESSION_EXPIRED" });
    expect(run(expired, { type: "SESSION_RESTORED" })).toMatchObject({ status: "dirty", unsaved: true, errorCode: null });
    expect(run(inStatus("session-expired", { unsaved: false }), { type: "SESSION_RESTORED" }).status).toBe("editing");
    expect(run(base, { type: "SESSION_EXPIRED" })).toBe(base);
    expect(run(base, { type: "SESSION_RESTORED" })).toBe(base);
  });

  it("tracks offline independently of the status; coming online zeroes the backoff", () => {
    const offline = run(failed, { type: "OFFLINE" });
    expect(offline).toMatchObject({ status: "save-failed", offline: true });
    expect(run(offline, { type: "ONLINE" })).toMatchObject({ status: "save-failed", offline: false, failures: 0 });
    expect(run(base, { type: "OFFLINE" }).status).toBe("editing");
  });
});

describe("draftMachine: publish and delete", () => {
  it("Editing -> Publishing -> Published", () => {
    expect(run(base, { type: "PUBLISH_STARTED" }, { type: "PUBLISH_SUCCEEDED" }).status).toBe("published");
  });

  it("Publishing -> PublishFailed -> Editing, and a session expiry during publish is surfaced", () => {
    const failed = run(base, { type: "PUBLISH_STARTED" }, { type: "PUBLISH_FAILED", code: "files_pending" });
    expect(failed).toMatchObject({ status: "publish-failed", errorCode: "files_pending" });
    expect(run(failed, { type: "PUBLISH_DISMISSED" })).toMatchObject({ status: "editing", errorCode: null });
    expect(run(base, { type: "PUBLISH_STARTED" }, { type: "SESSION_EXPIRED" }).status).toBe("session-expired");
  });

  it("only publishes from a saved draft and ignores edits while publishing", () => {
    const dirty = run(base, { type: "CHANGE" });
    expect(run(dirty, { type: "PUBLISH_STARTED" })).toBe(dirty);
    const publishing = run(base, { type: "PUBLISH_STARTED" });
    expect(run(publishing, { type: "CHANGE" })).toBe(publishing);
    expect(run(base, { type: "PUBLISH_SUCCEEDED" })).toBe(base);
    expect(run(base, { type: "PUBLISH_FAILED" })).toBe(base);
    expect(run(base, { type: "PUBLISH_DISMISSED" })).toBe(base);
  });

  it("Editing -> Deleting -> deleted, or back to Editing on failure", () => {
    expect(run(base, { type: "DELETE_STARTED" }, { type: "DELETE_SUCCEEDED" }).status).toBe("deleted");
    expect(run(base, { type: "DELETE_STARTED" }, { type: "DELETE_FAILED" }).status).toBe("editing");
    expect(run(base, { type: "DELETE_SUCCEEDED" })).toBe(base);
    expect(run(base, { type: "DELETE_FAILED" })).toBe(base);
    expect(run(run(base, { type: "CHANGE" }), { type: "DELETE_STARTED" }).status).toBe("dirty");
  });
});

describe("draftMachine: creating", () => {
  it("Creating -> Editing with the new revision; failure -> retry -> Creating", () => {
    const creating = creatingState();
    expect(creating.status).toBe("creating");
    expect(run(creating, { type: "CREATE_SUCCEEDED", revision: 1, at: 10 })).toMatchObject({ status: "editing", revision: 1, lastSavedAt: 10 });
    const failed = run(creating, { type: "CREATE_FAILED", code: "network" });
    expect(failed).toMatchObject({ status: "create-failed", errorCode: "network" });
    expect(run(failed, { type: "CREATE_STARTED" })).toMatchObject({ status: "creating", errorCode: null });
    expect(run(base, { type: "CREATE_SUCCEEDED", revision: 1, at: 1 })).toBe(base);
    expect(run(base, { type: "CREATE_FAILED" })).toBe(base);
    expect(run(base, { type: "CREATE_STARTED" })).toBe(base);
  });

  it("does not accept edits before the draft exists", () => {
    const creating = creatingState();
    expect(run(creating, { type: "CHANGE" })).toBe(creating);
  });
});
