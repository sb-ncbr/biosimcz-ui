"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import {
  computeCompleteness,
  sanitizeDraft,
  type Completeness,
  type DepositionDraft,
  type DraftFileInfo,
  type DraftSnapshot,
} from "@/entities/deposition";
import { loadDraftRequest, saveDraftRequest, type SaveOutcome } from "../api/draftClient";
import { createInitialState, draftReducer, type DraftState } from "../model/draftMachine";
import { createIdbMirror, shouldOfferRestore, type DraftMirror, type MirrorEntry } from "../model/mirror";
import { toSaveState, type DraftSaveState } from "../model/saveState";
import { useAutosave } from "../model/useAutosave";

type DraftContextValue = {
  draftId: string;
  draft: DepositionDraft;
  files: DraftFileInfo[];
  completeness: Completeness;
  state: DraftState;
  save: DraftSaveState;
  // Every edit goes through here: it updates the values, marks the draft dirty and mirrors it locally.
  updateDraft: (recipe: (draft: DepositionDraft) => DepositionDraft) => void;
  // Server file list (uploads, removals); the pipeline owns it, the draft values only carry the committed keys.
  setFiles: (recipe: (files: DraftFileInfo[]) => DraftFileInfo[]) => void;
  flush: () => Promise<void>;
  retryNow: () => void;
  // Unsaved local changes from an earlier visit that are newer than the server copy.
  restore: MirrorEntry | null;
  restoreMirror: () => void;
  discardMirror: () => void;
  // Conflict resolution: take the server copy, or keep the local values on top of the current server revision.
  reloadFromServer: () => Promise<boolean>;
  keepMine: () => Promise<boolean>;
};

const DraftContext = createContext<DraftContextValue | null>(null);

const useDraft = (): DraftContextValue => {
  const value = useContext(DraftContext);
  if (!value) throw new Error("useDraft must be used inside DraftProvider");
  return value;
};

type DraftProviderProps = {
  // Loaded once by the wizard layout; later prop changes are ignored so a refresh can never overwrite local edits.
  initial: DraftSnapshot;
  // Owner of the local mirror: entries of other users are never offered.
  userId: string;
  // Injected in tests; defaults to the IndexedDB mirror.
  mirror?: DraftMirror;
  children: ReactNode;
};

const CLOCK_TICK_MS = 30_000;

const DraftProvider = ({ initial, userId, mirror: injectedMirror, children }: DraftProviderProps) => {
  const [first] = useState(initial);
  const draftId = first.id;
  const [mirror] = useState<DraftMirror>(() => injectedMirror ?? createIdbMirror(userId));
  const [draft, setDraft] = useState(first.draft);
  const [files, setFilesState] = useState(first.files);
  const [restore, setRestore] = useState<MirrorEntry | null>(null);
  // Null until mounted: the server and the first client render show the same label, so hydration never mismatches.
  const [now, setNow] = useState<number | null>(null);
  const [state, dispatch] = useReducer(draftReducer, { revision: first.revision, savedAt: Date.parse(first.updatedAt) }, createInitialState);

  // Values live in a ref as well, so a save started from a timer or pagehide always sees the latest edit.
  const draftRef = useRef(first.draft);
  const versionRef = useRef(0);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const replaceValues = useCallback((next: DepositionDraft) => {
    draftRef.current = next;
    versionRef.current += 1;
    setDraft(next);
  }, []);

  const updateDraft = useCallback(
    (recipe: (draft: DepositionDraft) => DepositionDraft) => {
      replaceValues(recipe(draftRef.current));
      dispatch({ type: "CHANGE" });
      void mirror.write(draftId, { draft: draftRef.current, baseRevision: stateRef.current.revision, savedAt: Date.now() });
    },
    [draftId, mirror, replaceValues],
  );

  const setFiles = useCallback((recipe: (files: DraftFileInfo[]) => DraftFileInfo[]) => setFilesState(recipe), []);

  const send = useCallback(
    async ({ revision, keepalive }: { revision: number; keepalive: boolean }): Promise<SaveOutcome> => {
      // The server only ever holds valid data; what the user typed and cannot be saved yet stays in the mirror.
      const snapshot = sanitizeDraft(draftRef.current);
      const version = versionRef.current;
      const outcome = await saveDraftRequest(draftId, snapshot, revision, { keepalive });
      if (outcome.kind === "saved" && versionRef.current === version) void mirror.clear(draftId);
      return outcome;
    },
    [draftId, mirror],
  );

  const { flush, retryNow } = useAutosave({ state, dispatch, send });

  // Mirror from an earlier visit: offer it when newer than the server copy, otherwise tidy it away.
  useEffect(() => {
    let cancelled = false;
    void mirror.read(draftId).then((entry) => {
      if (cancelled || !entry) return;
      if (shouldOfferRestore(entry, first)) setRestore(entry);
      else void mirror.clear(draftId);
    });
    return () => {
      cancelled = true;
    };
  }, [draftId, first, mirror]);

  const restoreMirror = useCallback(() => {
    if (!restore) return;
    replaceValues(restore.draft);
    dispatch({ type: "CHANGE" });
    void mirror.write(draftId, { ...restore, savedAt: Date.now() });
    setRestore(null);
  }, [draftId, mirror, replaceValues, restore]);

  const discardMirror = useCallback(() => {
    void mirror.clear(draftId);
    setRestore(null);
  }, [draftId, mirror]);

  const reloadFromServer = useCallback(async (): Promise<boolean> => {
    const [result, local] = await Promise.all([loadDraftRequest(draftId), mirror.read(draftId)]);
    if (!result.ok) return false;
    replaceValues(result.value.draft);
    setFilesState(result.value.files);
    dispatch({ type: "RELOAD_SERVER", revision: result.value.revision, at: Date.parse(result.value.updatedAt) });
    // What this tab had typed stays available for re-entry.
    if (local) setRestore(local);
    return true;
  }, [draftId, mirror, replaceValues]);

  const keepMine = useCallback(async (): Promise<boolean> => {
    const result = await loadDraftRequest(draftId);
    if (!result.ok) return false;
    setFilesState(result.value.files);
    dispatch({ type: "KEEP_MINE", revision: result.value.revision });
    return true;
  }, [draftId]);

  // Flush on step navigation, tab hidden and pagehide; track connectivity; warn before losing failed saves.
  const pathname = usePathname();
  useEffect(() => {
    void flush();
  }, [pathname, flush]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") void flush({ keepalive: true });
    };
    const onPageHide = () => void flush({ keepalive: true });
    const onOffline = () => dispatch({ type: "OFFLINE" });
    const onOnline = () => dispatch({ type: "ONLINE" });
    if (!navigator.onLine) onOffline();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [flush]);

  const stuck = state.unsaved && (state.status === "save-failed" || state.status === "conflict" || state.status === "session-expired" || state.offline);
  useEffect(() => {
    if (!stuck) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [stuck]);

  // Keeps "Saved 3 min ago" honest without a re-render per second.
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, CLOCK_TICK_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  const completeness = useMemo(() => computeCompleteness(draft), [draft]);
  const save = useMemo(() => toSaveState(state, now), [state, now]);

  const value = useMemo<DraftContextValue>(
    () => ({
      draftId,
      draft,
      files,
      completeness,
      state,
      save,
      updateDraft,
      setFiles,
      flush: () => flush(),
      retryNow,
      restore,
      restoreMirror,
      discardMirror,
      reloadFromServer,
      keepMine,
    }),
    [draftId, draft, files, completeness, state, save, updateDraft, setFiles, flush, retryNow, restore, restoreMirror, discardMirror, reloadFromServer, keepMine],
  );

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
};

export { DraftProvider, useDraft };
export type { DraftContextValue, DraftProviderProps };
