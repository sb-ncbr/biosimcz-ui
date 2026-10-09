"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster, TooltipProvider } from "@e-infra/design-system";
import { useState, type ReactNode } from "react";

const Providers = ({ children }: { children: ReactNode }) => {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false } } }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>{children}</TooltipProvider>
      <Toaster />
    </QueryClientProvider>
  );
};

export { Providers };
