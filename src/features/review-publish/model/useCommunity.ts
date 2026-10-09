"use client";

import { useQuery } from "@tanstack/react-query";
import { useLookups, type Community } from "@/features/step-study";

// Name and address of the chosen community. Shares the query key with the Step 1 combobox, so it is usually cached.
const useCommunity = (communityId: string | undefined): Community | undefined => {
  const lookups = useLookups();
  const communities = useQuery({ queryKey: ["study", "communities"], queryFn: () => lookups.communities() });
  return communityId ? communities.data?.find((community) => community.id === communityId) : undefined;
};

export { useCommunity };
