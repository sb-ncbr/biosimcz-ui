"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useRegisterUploads } from "@/features/upload";
import { useSystemUploads, type UseSystemUploads } from "../model/useSystemUploads";

const SystemUploadsContext = createContext<UseSystemUploads | null>(null);

const useSystemUploadsContext = (): UseSystemUploads => {
  const value = useContext(SystemUploadsContext);
  if (!value) throw new Error("useSystemUploadsContext must be used inside SystemUploadsProvider");
  return value;
};

type SystemUploadsProviderProps = {
  // Test seam for the upload transport; production uses the XHR one.
  options?: Parameters<typeof useSystemUploads>[0];
  children: ReactNode;
};

// Mounted by the wizard layout, inside DraftProvider, so uploads (and their prefill and fileKeys wiring) outlive the
// Step 2 page: leaving the step no longer unmounts the queue and aborts running requests. The Publish rule reads it.
const SystemUploadsProvider = ({ options, children }: SystemUploadsProviderProps) => {
  const value = useSystemUploads(options);
  useRegisterUploads("system", value.uploads);
  return <SystemUploadsContext.Provider value={value}>{children}</SystemUploadsContext.Provider>;
};

export { SystemUploadsProvider, useSystemUploadsContext };
export type { SystemUploadsProviderProps };
