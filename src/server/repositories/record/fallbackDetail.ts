import "server-only";
import { logger } from "../../lib/logger";
import type { RecordRepository } from "./types";

// Published depositions are linked to /records/{mdrepoId}; with MDposit as the search source those ids do not exist there.
// Detail only: search keeps using the primary source. A failing secondary counts as "not found", never as an error.
const withDetailFallback = (primary: RecordRepository, secondary: RecordRepository): RecordRepository => ({
  capabilities: primary.capabilities,
  search: primary.search,
  get: async (id) => {
    const record = await primary.get(id);
    if (record) return record;
    try {
      return await secondary.get(id);
    } catch (error) {
      logger.warn("detail fallback failed", { message: error instanceof Error ? error.message : "unknown" });
      return null;
    }
  },
});

export { withDetailFallback };
