import { isRecordId } from "@/entities/record/lib/recordId";
import type { ReplicaRef } from "../model/types";

// The ".N" suffix of an instance id is the 1-based position in the project's `mds` list (unverified for other orders).
const resolveReplica = (accession: string, replicaNames: readonly string[], replicaParam: string): ReplicaRef | null => {
  const index = replicaNames.indexOf(replicaParam);
  if (index < 0) return null;
  const number = index + 1;
  return { accession, name: replicaParam, number, instanceId: `${accession}.${number}` };
};

const isAccession = (value: unknown): value is string => isRecordId(value) && !value.includes(".");

const isInstanceId = (value: unknown): value is string => isRecordId(value) && /^[^.]+\.[1-9]\d*$/.test(value);

export { isAccession, isInstanceId, resolveReplica };
