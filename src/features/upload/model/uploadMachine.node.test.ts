import { describe, expect, it } from "vitest";
import {
  initialUploadState,
  summarize,
  uploadReducer,
  type UploadAction,
  type UploadItem,
  type UploadState,
} from "./uploadMachine";

const file = (id: string, name = `${id}.top`, size = 1000) => ({ id, name, size, lastModified: 42 });

const run = (actions: UploadAction[], from: UploadState = { items: [] }): UploadState => actions.reduce(uploadReducer, from);
const only = (state: UploadState): UploadItem => {
  const item = state.items[0];
  if (!item) throw new Error("no item");
  return item;
};

const uploaded: UploadAction[] = [
  { type: "dropped", files: [file("a")] },
  { type: "started", id: "a" },
  { type: "initiated", id: "a" },
  { type: "progress", id: "a", loaded: 400 },
  { type: "uploaded", id: "a" },
  { type: "committed", id: "a" },
];

describe("uploadReducer happy path", () => {
  it("walks queued -> initiating -> uploading -> committing -> parsing -> done", () => {
    const steps: [string, UploadAction][] = [
      ["queued", { type: "dropped", files: [file("a")] }],
      ["initiating", { type: "started", id: "a" }],
      ["uploading", { type: "initiated", id: "a" }],
      ["committing", { type: "uploaded", id: "a" }],
      ["parsing", { type: "committed", id: "a" }],
      ["done", { type: "parsed", id: "a", parse: { status: "ok", fields: [{ path: "x", value: 1 }] }, role: "topology" }],
    ];
    let state: UploadState = { items: [] };
    for (const [expected, action] of steps) {
      state = uploadReducer(state, action);
      expect(only(state).status).toBe(expected);
    }
    expect(only(state).parse?.status).toBe("ok");
  });

  it("keeps progress monotonic and capped at the file size", () => {
    let state = run(uploaded.slice(0, 3));
    state = run([{ type: "progress", id: "a", loaded: 600 }, { type: "progress", id: "a", loaded: 300 }], state);
    expect(only(state).loaded).toBe(600);
    state = uploadReducer(state, { type: "progress", id: "a", loaded: 99_999 });
    expect(only(state).loaded).toBe(1000);
  });

  it("finishes as done without parse data when parsing produced nothing", () => {
    const state = run([...uploaded, { type: "parsed", id: "a" }]);
    expect(only(state)).toMatchObject({ status: "done" });
    expect(only(state).parse).toBeUndefined();
  });
});

describe("uploadReducer failures", () => {
  it.each(["initiating", "uploading", "committing"] as const)("fails from %s and can retry", (status) => {
    const path = { initiating: 1, uploading: 2, committing: 4 }[status];
    let state = run(uploaded.slice(0, path + 1));
    expect(only(state).status).toBe(status);
    state = uploadReducer(state, { type: "failed", id: "a", reason: "network" });
    expect(only(state)).toMatchObject({ status: "failed", failReason: "network", loaded: 0 });
    state = uploadReducer(state, { type: "retry", id: "a" });
    expect(only(state).status).toBe("queued");
    expect(only(state).failReason).toBeUndefined();
  });

  it("turns an auth failure into interrupted and resumes to queued", () => {
    let state = run([...uploaded.slice(0, 3), { type: "failed", id: "a", reason: "auth" }]);
    expect(only(state).status).toBe("interrupted");
    state = uploadReducer(state, { type: "resume_mismatch", id: "a" });
    expect(only(state).resumeMismatch).toBe(true);
    state = uploadReducer(state, { type: "resumed", id: "a" });
    expect(only(state)).toMatchObject({ status: "queued" });
    expect(only(state).resumeMismatch).toBeUndefined();
  });

  it("ignores events that are invalid for the current state", () => {
    const start = run([{ type: "dropped", files: [file("a")] }]);
    expect(uploadReducer(start, { type: "committed", id: "a" })).toBe(start);
    expect(uploadReducer(start, { type: "retry", id: "a" })).toBe(start);
    expect(uploadReducer(start, { type: "failed", id: "a", reason: "network" })).toBe(start);
    expect(uploadReducer(start, { type: "progress", id: "missing", loaded: 1 })).toBe(start);
  });
});

describe("uploadReducer remove", () => {
  it("drops queued, uploading and failed items locally", () => {
    for (const upTo of [1, 3]) {
      const state = run([...uploaded.slice(0, upTo), { type: "remove", id: "a" }]);
      expect(state.items).toHaveLength(0);
    }
    const failed = run([...uploaded.slice(0, 3), { type: "failed", id: "a", reason: "rejected" }, { type: "remove", id: "a" }]);
    expect(failed.items).toHaveLength(0);
  });

  it("a late event after remove does not resurrect the item", () => {
    const state = run([...uploaded.slice(0, 3), { type: "remove", id: "a" }, { type: "uploaded", id: "a" }, { type: "failed", id: "a", reason: "network" }]);
    expect(state.items).toHaveLength(0);
  });

  it("done items go through removing -> removed, or remove_failed and retry", () => {
    const done = run([...uploaded, { type: "parsed", id: "a" }]);
    let state = uploadReducer(done, { type: "remove", id: "a" });
    expect(only(state).status).toBe("removing");
    state = uploadReducer(state, { type: "remove_failed", id: "a" });
    expect(only(state).status).toBe("remove_failed");
    state = uploadReducer(state, { type: "remove", id: "a" });
    expect(only(state).status).toBe("removing");
    expect(uploadReducer(state, { type: "removed", id: "a" }).items).toHaveLength(0);
  });
});

describe("uploadReducer dropped", () => {
  it("rejects duplicates against existing rows and within one drop", () => {
    const state = run([
      { type: "dropped", files: [file("a", "topol.top")] },
      { type: "dropped", files: [file("b", "topol.top"), file("c", "conf.gro"), file("d", "conf.gro")] },
    ]);
    const byId = Object.fromEntries(state.items.map((item) => [item.id, item]));
    expect(byId["b"]).toMatchObject({ status: "rejected", rejectReason: "duplicate" });
    expect(byId["c"]?.status).toBe("queued");
    expect(byId["d"]).toMatchObject({ status: "rejected", rejectReason: "duplicate" });
  });

  it("puts rejected rows first and clears them on the next drop", () => {
    let state = run([{ type: "dropped", files: [file("a"), { ...file("b"), rejectReason: "too_large" }] }]);
    expect(state.items.map((item) => item.id)).toEqual(["b", "a"]);
    state = uploadReducer(state, { type: "dropped", files: [file("c")] });
    expect(state.items.map((item) => item.id)).toEqual(["a", "c"]);
  });

  it("assigns a role from the extension", () => {
    const state = run([{ type: "dropped", files: [file("a", "conf.gro")] }]);
    expect(only(state).role).toBe("structure_and_box");
  });
});

describe("initialUploadState and summarize", () => {
  it("maps server files: completed is done, pending is interrupted", () => {
    const state = initialUploadState([
      { key: "topol.top", size: 10, status: "completed" },
      { key: "conf.gro", status: "pending" },
    ]);
    expect(state.items.map((item) => item.status)).toEqual(["done", "interrupted"]);
    expect(summarize(state)).toEqual({ total: 2, uploaded: 1, failed: 0, interrupted: 1, paused: 0, inFlight: 0 });
  });

  it("does not count rejected rows", () => {
    const state = run([{ type: "dropped", files: [file("a"), { ...file("b"), rejectReason: "type" }] }]);
    expect(summarize(state)).toMatchObject({ total: 1, inFlight: 1 });
  });
});
