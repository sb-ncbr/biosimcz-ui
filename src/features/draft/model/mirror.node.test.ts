import { describe, expect, it } from "vitest";
import { emptyDraft } from "@/entities/deposition";
import { completeDraft } from "@/test/depositionFixtures";
import { clearAllMirrors, createIdbMirror, createMemoryMirror, shouldOfferRestore, type MirrorEntry } from "./mirror";

type Handlers = { result?: unknown; error?: unknown; onsuccess?: () => void; onerror?: () => void; onupgradeneeded?: () => void };

// Just enough of IDBFactory for the mirror: open, one object store, get/put/delete. Requests settle on a microtask, like the real thing.
const createFakeIdb = (options: { failOpen?: boolean } = {}) => {
  const data = new Map<string, unknown>();
  const request = (run: () => unknown): Handlers => {
    const handlers: Handlers = {};
    queueMicrotask(() => {
      try {
        handlers.result = run();
        handlers.onsuccess?.();
      } catch (error) {
        handlers.error = error;
        handlers.onerror?.();
      }
    });
    return handlers;
  };
  const store = {
    get: (key: string) => request(() => data.get(key)),
    put: (value: unknown, key: string) => request(() => data.set(key, value) && key),
    delete: (key: string) => request(() => data.delete(key)),
    clear: () => request(() => data.clear()),
  };
  const db = { createObjectStore: () => store, transaction: () => ({ objectStore: () => store }) };
  const factory = {
    open: () => {
      const handlers: Handlers = {};
      queueMicrotask(() => {
        if (options.failOpen) {
          handlers.error = new Error("denied");
          handlers.onerror?.();
          return;
        }
        handlers.result = db;
        handlers.onupgradeneeded?.();
        handlers.onsuccess?.();
      });
      return handlers;
    },
  };
  return { factory: factory as unknown as IDBFactory, data };
};

const entry = (overrides: Partial<MirrorEntry> = {}): MirrorEntry => ({ draft: completeDraft(), baseRevision: 3, savedAt: 5000, ...overrides });

describe("mirror stores", () => {
  it("memory mirror reads, writes and clears per draft", async () => {
    const mirror = createMemoryMirror();
    expect(await mirror.read("a")).toBeNull();
    await mirror.write("a", entry());
    await mirror.write("b", entry({ baseRevision: 9 }));
    expect((await mirror.read("a"))?.baseRevision).toBe(3);
    await mirror.clear("a");
    expect(await mirror.read("a")).toBeNull();
    expect((await mirror.read("b"))?.baseRevision).toBe(9);
  });

  it("IndexedDB mirror round-trips through the store", async () => {
    const fake = createFakeIdb();
    const mirror = createIdbMirror("u1", fake.factory);
    await mirror.write("draft-1", entry());
    expect(fake.data.has("u1:draft-1")).toBe(true);
    expect(await mirror.read("draft-1")).toEqual(entry());
    await mirror.clear("draft-1");
    expect(await mirror.read("draft-1")).toBeNull();
  });

  it("keeps users apart: another user's entry is never returned and is discarded", async () => {
    const fake = createFakeIdb();
    await createIdbMirror("alice", fake.factory).write("draft-1", entry({ baseRevision: 4 }));
    const bob = createIdbMirror("bob", fake.factory);
    expect(await bob.read("draft-1")).toBeNull();
    // A stale entry under bob's key but stamped with another owner is dropped, not served.
    fake.data.set("bob:draft-1", { ...entry(), userId: "alice" });
    expect(await bob.read("draft-1")).toBeNull();
    expect(fake.data.has("bob:draft-1")).toBe(false);
    expect((await createIdbMirror("alice", fake.factory).read("draft-1"))?.baseRevision).toBe(4);
  });

  it("clearAllMirrors wipes every user's entries and never throws", async () => {
    const fake = createFakeIdb();
    await createIdbMirror("alice", fake.factory).write("d1", entry());
    await createIdbMirror("bob", fake.factory).write("d2", entry());
    await clearAllMirrors(fake.factory);
    expect(fake.data.size).toBe(0);
    await expect(clearAllMirrors(createFakeIdb({ failOpen: true }).factory)).resolves.toBeUndefined();
    await expect(clearAllMirrors(undefined)).resolves.toBeUndefined();
  });

  it("degrades to a no-op when IndexedDB is missing or refuses to open", async () => {
    const none = createIdbMirror("u1", undefined);
    await expect(none.write("x", entry())).resolves.toBeUndefined();
    expect(await none.read("x")).toBeNull();
    const broken = createIdbMirror("u1", createFakeIdb({ failOpen: true }).factory);
    await expect(broken.write("x", entry())).resolves.toBeUndefined();
    expect(await broken.read("x")).toBeNull();
  });
});

describe("shouldOfferRestore", () => {
  const server = { updatedAt: new Date(4000).toISOString(), draft: emptyDraft() };

  it("offers a mirror that is newer than the server copy and different from it", () => {
    expect(shouldOfferRestore(entry(), server)).toBe(true);
  });

  it("stays quiet when there is no mirror, it is older, or the content is identical (key order ignored)", () => {
    expect(shouldOfferRestore(null, server)).toBe(false);
    expect(shouldOfferRestore(entry({ savedAt: 3000 }), server)).toBe(false);
    const same = completeDraft();
    const reordered = JSON.parse(JSON.stringify({ runs: same.runs, system: same.system, study: same.study }));
    expect(shouldOfferRestore(entry({ draft: reordered }), { updatedAt: server.updatedAt, draft: same })).toBe(false);
  });
});
