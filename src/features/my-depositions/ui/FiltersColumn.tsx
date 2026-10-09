"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { DepositionFacets, DepositionListQuery } from "@/entities/deposition";
import { bffFetch } from "@/shared/lib";
import {
  Badge,
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui";
import { activeFilterCount, clearFilters, serializeListQuery } from "../model/urlState";
import { FiltersPanel } from "./facets/FiltersPanel";
import { useListNavigation } from "./ListNavigation";

type FiltersProps = { facets: DepositionFacets; total: number };

// lg and up: the fixed column of the design; facet clicks go straight to the URL.
const FiltersColumn = ({ facets }: FiltersProps) => {
  const { query, navigate } = useListNavigation();
  return (
    <aside aria-label="Filters" className="hidden w-55 shrink-0 lg:block xl:w-60">
      <FiltersPanel query={query} facets={facets} onChange={navigate} />
    </aside>
  );
};

// Live result count for the choices made inside the sheet (they are applied only on "Show N results").
const usePendingTotal = (draft: DepositionListQuery, applied: DepositionListQuery, appliedTotal: number, open: boolean): number | null => {
  const changed = serializeListQuery(draft) !== serializeListQuery(applied);
  const { data } = useQuery({
    queryKey: ["my-depositions", "count", serializeListQuery(draft)],
    enabled: open && changed,
    staleTime: 30_000,
    queryFn: async () => {
      const result = await bffFetch<{ total: number }>(`/bff/depositions${serializeListQuery(draft)}`);
      if (!result.ok) throw new Error(result.error.messageKey);
      return result.value.total;
    },
  });
  if (!changed) return appliedTotal;
  return data ?? null;
};

// Below lg: a "Filters (n)" button opens the same facets in a left sheet (missing-states 7.4).
const MobileFilters = ({ facets, total }: FiltersProps) => {
  const { query, navigate } = useListNavigation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(query);
  const count = activeFilterCount(query);
  const pendingTotal = usePendingTotal(draft, query, total, open);

  const apply = () => {
    navigate(draft);
    setOpen(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(query);
        setOpen(next);
      }}
    >
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="lg:hidden max-lg:min-h-11">
          Filters
          {count > 0 ? <Badge className="px-1.5 text-[11px]">{count}</Badge> : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-[min(22rem,100vw)] flex-col gap-0 p-0">
        <SheetHeader className="border-border border-b">
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription className="sr-only">Narrow your depositions. Changes apply when you press Show results.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4">
          <FiltersPanel query={draft} facets={facets} onChange={setDraft} hideHeader />
        </div>
        <SheetFooter className="border-border sticky bottom-0 flex-row items-center justify-between gap-3 border-t bg-background">
          <Button type="button" className="min-h-11 flex-1" onClick={apply}>
            {pendingTotal === null ? "Show results" : `Show ${pendingTotal} ${pendingTotal === 1 ? "result" : "results"}`}
          </Button>
          <Button type="button" variant="link" className="min-h-11" onClick={() => setDraft(clearFilters(draft))} disabled={activeFilterCount(draft) === 0}>
            Clear all
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export { FiltersColumn, MobileFilters };
