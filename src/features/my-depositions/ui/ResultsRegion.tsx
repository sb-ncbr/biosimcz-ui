"use client";

import type { ReactNode } from "react";
import { cn } from "@/shared/lib";
import { useListNavigation } from "./ListNavigation";

// Keeps the previous cards on screen while a filter change loads (no skeleton flash, missing-states 4.3) and tells
// assistive tech how many results there are.
const ResultsRegion = ({ total, children }: { total: number; children: ReactNode }) => {
  const { pending } = useListNavigation();
  return (
    <div aria-busy={pending} className={cn("mt-4 transition-opacity", pending && "opacity-60")}>
      <p role="status" className="sr-only">
        {total === 0 ? "No depositions match" : `${total} ${total === 1 ? "deposition" : "depositions"}`}
      </p>
      {children}
    </div>
  );
};

export { ResultsRegion };
