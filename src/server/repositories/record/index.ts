import "server-only";
import { getEnv } from "../../config/env";
import { withCache } from "./cachedRepository";
import { withDetailFallback } from "./fallbackDetail";
import { mdpositRecordRepository } from "./mdposit/mdpositRecordRepository";
import { mdrepoRecordRepository } from "./mdrepoRecordRepository";
import type { RecordRepository } from "./types";

const TTL = { searchMs: 60_000, getMs: 5 * 60_000 };

let built: { source: string; repository: RecordRepository } | undefined;

// One seam for the data source: pages call this and never import server/backends directly. The source is the
// RECORDS_SOURCE env value; the instance (and its cache) lives as long as the server process.
const getRecordRepository = (): RecordRepository => {
  const source = getEnv().recordsSource;
  if (built?.source !== source) {
    const repository =
      source === "mdrepo" ? withCache(mdrepoRecordRepository, TTL) : withCache(withDetailFallback(mdpositRecordRepository, mdrepoRecordRepository), TTL);
    built = { source, repository };
  }
  return built.repository;
};

export { getRecordRepository };
export type { RecordRepository };
