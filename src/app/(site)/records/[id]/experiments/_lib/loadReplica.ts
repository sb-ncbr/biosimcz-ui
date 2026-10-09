import { cache } from "react";
import { isRecordId, type RecordDetail } from "@/entities/record";
import { isAccession, resolveReplica, type ReplicaDetail } from "@/entities/replica";
import type { ReplicaNavItem } from "@/features/replica-nav";
import { getRecordRepository } from "@/server/repositories/record";
import { getReplicaRepository } from "@/server/repositories/replica";

type ExperimentsRecord = RecordDetail & { accession: string };

type ReplicaContext = {
  accession: string;
  record: ExperimentsRecord;
  replica: ReplicaDetail;
  // Every replica of the record with its analyses, so the nav can keep the current analysis when switching.
  replicas: ReplicaNavItem[];
};

// Replicas exist for MDposit records only: MDRepo ids have no accession and resolve to null here.
const loadExperimentsRecord = cache(async (id: string): Promise<ExperimentsRecord | null> => {
  if (!isRecordId(id) || !isAccession(id)) return null;
  const record = await getRecordRepository().get(id);
  return record?.accession ? { ...record, accession: record.accession } : null;
});

// cache(): layout, generateMetadata and pages of one request share the backend calls. `replicaParam` is the decoded
// segment as Next hands it over; it is matched against the record's names as is.
const loadReplicaContext = cache(async (id: string, replicaParam: string): Promise<ReplicaContext | null> => {
  const record = await loadExperimentsRecord(id);
  if (!record) return null;
  const { accession, replicaNames } = record;
  if (!resolveReplica(accession, replicaNames, replicaParam)) return null;

  const repository = getReplicaRepository();
  const details = await Promise.allSettled(
    replicaNames.map(async (name) => {
      const ref = resolveReplica(accession, replicaNames, name);
      return ref ? repository.get(ref) : null;
    }),
  );

  const replicas: ReplicaNavItem[] = [];
  let replica: ReplicaDetail | null = null;
  replicaNames.forEach((name, index) => {
    const result = details[index];
    const detail = result?.status === "fulfilled" ? result.value : null;
    // A failing sibling only loses its analyses in the nav; the current replica must not hide an upstream failure.
    if (name === replicaParam) {
      if (result?.status === "rejected") throw result.reason;
      replica = detail;
    }
    replicas.push({ name, analyses: detail?.analyses ?? [] });
  });

  return replica ? { accession, record, replica, replicas } : null;
});

// This Next version hands dynamic params over still percent-encoded ("replica%201"), so the name is decoded here, once.
const decodeReplicaParam = (param: string): string => {
  try {
    return decodeURIComponent(param);
  } catch {
    return param;
  }
};

export { decodeReplicaParam, loadExperimentsRecord, loadReplicaContext };
