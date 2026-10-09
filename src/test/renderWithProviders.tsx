import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@e-infra/design-system";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

const renderWithProviders = (ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  );
  return render(ui, { wrapper: Wrapper, ...options });
};

export { renderWithProviders };
