import { describe, expect, it } from "vitest";
import { createInitialState, draftReducer, type DraftEvent } from "./draftMachine";
import { backoffDelayMs, formatSavedLabel, toSaveState } from "./saveState";

const T0 = Date.UTC(2026, 8, 30, 12, 0, 0);
const run = (...events: DraftEvent[]) => events.reduce(draftReducer, createInitialState({ revision: 1, savedAt: T0 }));

describe("formatSavedLabel", () => {
  it("counts up from just now to minutes to a clock time", () => {
    expect(formatSavedLabel(T0, T0 + 3000)).toBe("Saved just now");
    expect(formatSavedLabel(T0, T0 + 30_000)).toBe("Saved just now");
    expect(formatSavedLabel(T0, T0 + 3 * 60_000)).toBe("Saved 3 min ago");
    expect(formatSavedLabel(T0, T0 + 59 * 60_000)).toBe("Saved 59 min ago");
    expect(formatSavedLabel(T0, T0 + 2 * 3_600_000)).toMatch(/^Saved at \d{2}:\d{2}$/);
    expect(formatSavedLabel(null, T0)).toBe("Saved");
    // No clock yet (server render, hydration): a stable label, never relative time.
    expect(formatSavedLabel(T0, null)).toBe("Saved");
    expect(formatSavedLabel(T0 + 5000, T0)).toBe("Saved just now");
  });
});

describe("backoffDelayMs", () => {
  it("is 2 s, 5 s, 10 s and then every 30 s; zero retries at once", () => {
    expect([0, 1, 2, 3, 4, 9].map(backoffDelayMs)).toEqual([0, 2000, 5000, 10_000, 30_000, 30_000]);
  });
});

describe("toSaveState", () => {
  it("shows saved for editing and dirty (no unsaved flicker)", () => {
    expect(toSaveState(run(), T0 + 4000)).toEqual({ kind: "saved", label: "Saved just now" });
    expect(toSaveState(run({ type: "CHANGE" }), T0 + 4000).kind).toBe("saved");
  });

  it("maps saving, failures, conflict and session expiry", () => {
    const saving = run({ type: "CHANGE" }, { type: "SAVE_STARTED" });
    expect(toSaveState(saving, T0).kind).toBe("saving");
    const failed = draftReducer(saving, { type: "SAVE_FAILED" });
    expect(toSaveState(failed, T0).kind).toBe("retrying");
    const many = [1, 2, 3].reduce<ReturnType<typeof run>>((state) => draftReducer(draftReducer(state, { type: "SAVE_STARTED" }), { type: "SAVE_FAILED" }), failed);
    expect(toSaveState(many, T0).kind).toBe("failed");
    expect(toSaveState(draftReducer(saving, { type: "SAVE_CONFLICT" }), T0).kind).toBe("conflict");
    expect(toSaveState(draftReducer(saving, { type: "SESSION_EXPIRED" }), T0).kind).toBe("session-expired");
  });

  it("shows offline only while there are unsaved changes", () => {
    expect(toSaveState(run({ type: "OFFLINE" }), T0).kind).toBe("saved");
    expect(toSaveState(run({ type: "OFFLINE" }, { type: "CHANGE" }), T0).kind).toBe("offline");
  });
});
