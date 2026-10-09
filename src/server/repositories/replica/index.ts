import "server-only";
import { withCache } from "./cachedRepository";
import { mdpositReplicaRepository } from "./mdpositReplicaRepository";
import type { ReplicaRepository } from "./types";

const TTL = { getMs: 5 * 60_000, optionsMs: 10 * 60_000 };

let built: ReplicaRepository | undefined;

// One seam for replica data, like getRecordRepository: pages never import server/backends directly. The instance (and its
// cache) lives as long as the server process.
const getReplicaRepository = (): ReplicaRepository => {
  built ??= withCache(mdpositReplicaRepository, TTL);
  return built;
};

export { getReplicaRepository };
