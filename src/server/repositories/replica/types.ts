import type { AnalysisOption } from "@/entities/analysis";
import type { ReplicaDetail, ReplicaRef } from "@/entities/replica";

type ReplicaRepository = {
  // null = the replica does not exist upstream.
  get: (ref: ReplicaRef) => Promise<ReplicaDetail | null>;
  // Variants of a base analysis ("clusters" -> [{ name: "Overall", analysis: "clusters-00" }, ...]). null = no such analysis.
  analysisOptions: (instanceId: string, base: string) => Promise<AnalysisOption[] | null>;
};

export type { ReplicaRepository };
