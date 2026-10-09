import "server-only";

type TtlCache<V> = {
  get: (key: string) => V | undefined;
  set: (key: string, value: V, ttlMs: number) => void;
  readonly size: number;
};

// Bounded in-memory cache for anonymous public data only. A Map keeps insertion order, so re-inserting on read makes the
// first key the least recently used one.
const createTtlCache = <V>(maxEntries = 500, now: () => number = Date.now): TtlCache<V> => {
  const entries = new Map<string, { value: V; expiresAt: number }>();
  return {
    get: (key) => {
      const entry = entries.get(key);
      if (!entry) return undefined;
      entries.delete(key);
      if (entry.expiresAt <= now()) return undefined;
      entries.set(key, entry);
      return entry.value;
    },
    set: (key, value, ttlMs) => {
      entries.delete(key);
      entries.set(key, { value, expiresAt: now() + ttlMs });
      while (entries.size > maxEntries) {
        const oldest = entries.keys().next();
        if (oldest.done) break;
        entries.delete(oldest.value);
      }
    },
    get size() {
      return entries.size;
    },
  };
};

export { createTtlCache };

