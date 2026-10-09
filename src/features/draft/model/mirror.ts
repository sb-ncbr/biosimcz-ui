import type { DepositionDraft } from "@/entities/deposition";

// Local mirror of the values the user typed and the server does not have yet (plan 4.3): a crash, an offline period or
// an expired session loses nothing. Written on every change, cleared after a save that covers it. No file blobs.
// Entries belong to one user: they are keyed by user id + draft id, re-checked on read, and the whole store is wiped
// on logout and on the login page, so a shared browser never shows one person's values to the next.

type MirrorEntry = {
  draft: DepositionDraft;
  // Server revision the values were based on.
  baseRevision: number;
  savedAt: number;
};

type DraftMirror = {
  read(draftId: string): Promise<MirrorEntry | null>;
  write(draftId: string, entry: MirrorEntry): Promise<void>;
  clear(draftId: string): Promise<void>;
};

type StoredEntry = MirrorEntry & { userId: string };

const createMemoryMirror = (): DraftMirror & { entries: Map<string, MirrorEntry> } => {
  const entries = new Map<string, MirrorEntry>();
  return {
    entries,
    read: async (draftId) => entries.get(draftId) ?? null,
    write: async (draftId, entry) => {
      entries.set(draftId, entry);
    },
    clear: async (draftId) => {
      entries.delete(draftId);
    },
  };
};

const DB_NAME = "mdrepo-drafts";
const STORE = "mirror";

const promisify = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });

const openDb = (factory: IDBFactory): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = factory.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    request.onblocked = () => reject(new Error("IndexedDB open blocked"));
  });

// Every operation swallows storage errors (private windows, blocked site data, quota): the mirror is a safety net and
// must never break editing. Without IndexedDB it degrades to nothing.
const createIdbMirror = (userId: string, factory: IDBFactory | undefined = globalThis.indexedDB): DraftMirror => {
  if (!factory) return { read: async () => null, write: async () => undefined, clear: async () => undefined };
  let opened: Promise<IDBDatabase> | undefined;
  const db = () => (opened ??= openDb(factory));
  const keyOf = (draftId: string) => `${userId}:${draftId}`;

  const run = async <T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> => {
    try {
      const store = (await db()).transaction(STORE, mode).objectStore(STORE);
      return await promisify(action(store));
    } catch {
      opened = undefined;
      return undefined;
    }
  };

  return {
    read: async (draftId) => {
      const stored = await run("readonly", (store) => store.get(keyOf(draftId)) as IDBRequest<StoredEntry | undefined>);
      if (!stored) return null;
      if (stored.userId !== userId) {
        await run("readwrite", (store) => store.delete(keyOf(draftId)));
        return null;
      }
      return { draft: stored.draft, baseRevision: stored.baseRevision, savedAt: stored.savedAt };
    },
    write: async (draftId, entry) => {
      await run("readwrite", (store) => store.put({ ...entry, userId }, keyOf(draftId)));
    },
    clear: async (draftId) => {
      await run("readwrite", (store) => store.delete(keyOf(draftId)));
    },
  };
};

// Wipes every user's entries: called on logout and when the login page shows, where nobody is signed in.
const clearAllMirrors = async (factory: IDBFactory | undefined = globalThis.indexedDB): Promise<void> => {
  if (!factory) return;
  try {
    const store = (await openDb(factory)).transaction(STORE, "readwrite").objectStore(STORE);
    await promisify(store.clear());
  } catch {
    // Same rule as above: storage trouble never blocks the user.
  }
};

// Key order must not matter: the server copy and the local values are built by different code paths.
const stableStringify = (value: unknown): string =>
  JSON.stringify(value, (_key, item: unknown) =>
    typeof item === "object" && item !== null && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );

// A mirror is worth offering when it is newer than what the server has and actually differs from it.
const shouldOfferRestore = (entry: MirrorEntry | null, server: { updatedAt: string; draft: DepositionDraft }): entry is MirrorEntry =>
  entry !== null && entry.savedAt > Date.parse(server.updatedAt) && stableStringify(entry.draft) !== stableStringify(server.draft);

export { clearAllMirrors, createIdbMirror, createMemoryMirror, shouldOfferRestore };
export type { DraftMirror, MirrorEntry };
