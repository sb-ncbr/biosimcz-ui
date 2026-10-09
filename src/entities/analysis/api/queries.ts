import { queryOptions } from "@tanstack/react-query";
import { bffFetch, type BffError } from "@/shared/lib";
import { analysisDataUrl } from "../lib/href";
import { analysisKeys } from "./keys";

const TEN_MINUTES_MS = 10 * 60 * 1000;

// Payloads are immutable per replica, and the raw JSON stays unparsed: parsing is the registry's job.
const analysisDataQuery = (instanceId: string, name: string) =>
  queryOptions({
    queryKey: analysisKeys.data(instanceId, name),
    queryFn: async ({ signal }): Promise<unknown> => {
      const result = await bffFetch<unknown>(analysisDataUrl(instanceId, name), { signal });
      if (!result.ok) throw result.error;
      return result.value;
    },
    staleTime: Infinity,
    gcTime: TEN_MINUTES_MS,
    retry: (failureCount, error) => {
      const status = (error as Partial<BffError>).status;
      const retryable = status === undefined || status >= 500;
      return retryable && failureCount < 2;
    },
  });

export { analysisDataQuery };
