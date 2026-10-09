import type { DraftState } from "./draftMachine";

// Same union as the wizard shell's SaveState (a widget, so features cannot import it; the app passes it through).
type DraftSaveState =
  | { kind: "saved"; label: string }
  | { kind: "saving" }
  | { kind: "retrying" }
  | { kind: "failed" }
  | { kind: "offline" }
  | { kind: "session-expired" }
  | { kind: "conflict" };

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const clock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

// "Saved just now" / "Saved 3 min ago" / "Saved at 14:32" after an hour (missing-states 2.2). A null "now" (server
// render and hydration) gives plain "Saved": relative time and the local clock differ between server and client.
const formatSavedLabel = (savedAt: number | null, now: number | null): string => {
  if (savedAt === null || now === null) return "Saved";
  const age = Math.max(0, now - savedAt);
  if (age < MINUTE) return "Saved just now";
  if (age < HOUR) return `Saved ${Math.floor(age / MINUTE)} min ago`;
  return `Saved at ${clock.format(savedAt)}`;
};

// Backoff after failed saves: 2 s, 5 s, 10 s, then every 30 s. Zero means "now" (manual retry, back online).
const BACKOFF_MS = [2000, 5000, 10_000] as const;
const backoffDelayMs = (failures: number): number => (failures <= 0 ? 0 : (BACKOFF_MS[failures - 1] ?? 30_000));

// After this many failures the copy switches from "retrying" to plain "Not saved" and the content alert appears.
const RETRYING_LIMIT = 3;

const toSaveState = (state: DraftState, now: number | null): DraftSaveState => {
  if (state.status === "session-expired") return { kind: "session-expired" };
  if (state.status === "conflict") return { kind: "conflict" };
  if (state.offline && state.unsaved) return { kind: "offline" };
  if (state.status === "saving") return { kind: "saving" };
  if (state.status === "save-failed") return { kind: state.failures > RETRYING_LIMIT ? "failed" : "retrying" };
  // Dirty is deliberately shown as saved: an "Unsaved" flicker on every keystroke would only add noise.
  return { kind: "saved", label: formatSavedLabel(state.lastSavedAt, now) };
};

export { backoffDelayMs, formatSavedLabel, RETRYING_LIMIT, toSaveState };
export type { DraftSaveState };
