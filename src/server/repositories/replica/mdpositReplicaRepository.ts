import "server-only";
import { analysisOptionsSchema } from "@/entities/analysis";
import { getAnalysis, getProject } from "../../backends/mdposit/client";
import { replicaProjectSchema } from "../../backends/mdposit/projectSchemas";
import { ApiError, isApiError } from "../../http/errors";
import { toReplicaDetail } from "./mapper";
import type { ReplicaRepository } from "./types";

const DETAIL_TIMEOUT_MS = 10_000;

const schemaError = (): ApiError => new ApiError({ kind: "schema", backend: "mdposit" });

const nullWhenMissing = async <T>(load: () => Promise<T>): Promise<T | null> => {
  try {
    return await load();
  } catch (error) {
    if (isApiError(error) && error.kind === "not_found") return null;
    throw error;
  }
};

// Anonymous public reads of MDposit /projects/{instanceId} and /projects/{instanceId}/analyses/{base}.
const mdpositReplicaRepository: ReplicaRepository = {
  get: (ref) =>
    nullWhenMissing(async () => {
      const parsed = replicaProjectSchema.safeParse(await getProject(ref.instanceId, DETAIL_TIMEOUT_MS));
      if (!parsed.success) throw schemaError();
      return toReplicaDetail(parsed.data, ref);
    }),
  analysisOptions: (instanceId, base) =>
    nullWhenMissing(async () => {
      const parsed = analysisOptionsSchema.safeParse(await getAnalysis(instanceId, base));
      if (!parsed.success) throw schemaError();
      return parsed.data;
    }),
};

export { mdpositReplicaRepository };
