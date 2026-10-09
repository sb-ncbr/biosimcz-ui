import "server-only";
import { createTtlCache } from "../../lib/ttlCache";
import type { ReplicaRepository } from "./types";

type CacheTtl = { getMs: number; optionsMs: number };

// Same policy as the record cache: anonymous public data only, errors and null (unknown replica) are never cached.
const withCache = (repository: ReplicaRepository, ttl: CacheTtl): ReplicaRepository => {
  const replicas = createTtlCache<NonNullable<Awaited<ReturnType<ReplicaRepository["get"]>>>>();
  const options = createTtlCache<NonNullable<Awaited<ReturnType<ReplicaRepository["analysisOptions"]>>>>();
  return {
    get: async (ref) => {
      // The name is in the key because the mapper embeds it in the result.
      const key = `${ref.instanceId}|${ref.name}`;
      const hit = replicas.get(key);
      if (hit) return hit;
      const replica = await repository.get(ref);
      if (replica) replicas.set(key, replica, ttl.getMs);
      return replica;
    },
    analysisOptions: async (instanceId, base) => {
      const key = `${instanceId}|${base}`;
      const hit = options.get(key);
      if (hit) return hit;
      const found = await repository.analysisOptions(instanceId, base);
      if (found) options.set(key, found, ttl.optionsMs);
      return found;
    },
  };
};

export { withCache };
