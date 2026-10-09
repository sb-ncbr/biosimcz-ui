import "server-only";
import { request } from "../../http/request";
import { recordDetailSchema, recordSearchSchema } from "./recordSchemas";

// Public reads: anonymous on purpose (no Authorization header, no cookies), so signed-in users see the same results.

type RecordSearchWireQuery = {
  q?: string;
  sort?: string;
  page?: number;
  size?: number;
  access?: readonly string[];
  community?: readonly string[];
  engine?: readonly string[];
  keyword?: readonly string[];
};

// TODO(backend): E-R1 path unconfirmed
const searchRecords = (query: RecordSearchWireQuery) => request("mdrepo", "GET", ["api", "records"], recordSearchSchema, { query });

// TODO(backend): E-R2 path unconfirmed
const getRecord = (id: string) => request("mdrepo", "GET", ["api", "records", id], recordDetailSchema);

export { getRecord, searchRecords };
export type { RecordSearchWireQuery };
