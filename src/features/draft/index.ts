// Client-safe entry point. Server-only helpers (loadDraft) live in ./server so this barrel never drags them into a bundle.
export { loadDraftRequest, saveDraftRequest } from "./api/draftClient";
export type { SaveOutcome } from "./api/draftClient";
export { createInitialState, creatingState, draftReducer, hasUnsavedChanges } from "./model/draftMachine";
export type { DraftEvent, DraftState, DraftStatus } from "./model/draftMachine";
export { clearAllMirrors, createIdbMirror, createMemoryMirror, shouldOfferRestore } from "./model/mirror";
export type { DraftMirror, MirrorEntry } from "./model/mirror";
export { backoffDelayMs, formatSavedLabel, toSaveState } from "./model/saveState";
export type { DraftSaveState } from "./model/saveState";
export { useAutosave } from "./model/useAutosave";
export { DraftProvider, useDraft } from "./ui/DraftProvider";
export type { DraftContextValue } from "./ui/DraftProvider";
export { ClearMirrorsOnMount } from "./ui/ClearMirrorsOnMount";
export { DraftStatusAlerts } from "./ui/DraftStatusAlerts";
