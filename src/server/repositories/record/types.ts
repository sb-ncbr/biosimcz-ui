import type { RecordDetail, RecordSearchQuery, RecordSearchResult, RecordSourceCapabilities } from "@/entities/record";

// What pages and features see of the public records. Two adapters implement it: MDposit (default) and MDRepo
// (E-R1/E-R2, PROPOSED). Which one runs is the RECORDS_SOURCE env value; the UI renders from `capabilities`.
type RecordRepository = {
  capabilities: RecordSourceCapabilities;
  search: (query: RecordSearchQuery) => Promise<RecordSearchResult>;
  // null = unknown id, a draft or a record that is not public (the backend does not distinguish).
  get: (id: string) => Promise<RecordDetail | null>;
};

export type { RecordRepository };
