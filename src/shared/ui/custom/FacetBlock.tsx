"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, Collapsible, CollapsibleContent, CollapsibleTrigger } from "@e-infra/design-system";

type FacetBlockProps = {
  title: string;
  // Selected values inside this facet; shown as a pill next to the title.
  selectedCount?: number;
  children: ReactNode;
};

// One collapsible facet with the top rule of the design (102:11050).
const FacetBlock = ({ title, selectedCount = 0, children }: FacetBlockProps) => (
  <Collapsible defaultOpen className="border-border border-t py-3.5">
    <CollapsibleTrigger asChild>
      <button
        type="button"
        className="group focus-visible:ring-border-focus/50 flex min-h-6 w-full items-center gap-1.5 rounded-sm text-left text-[13px] font-semibold outline-none focus-visible:ring-[3px]"
      >
        <ChevronDown className="size-3.5 transition-transform group-data-[state=closed]:-rotate-90" aria-hidden />
        {title}
        {selectedCount > 0 ? <Badge className="px-1.5 text-[11px]">{selectedCount}</Badge> : null}
      </button>
    </CollapsibleTrigger>
    <CollapsibleContent className="flex flex-col gap-1.5 pt-2">{children}</CollapsibleContent>
  </Collapsible>
);

export { FacetBlock };
