"use client";

import { useState } from "react";
import { ACCESS_LABELS, ACCESS_VALUES } from "@/entities/deposition";
import type {
  FacetSpec,
  RecordFacetOption,
  RecordSearchResult,
  RecordSourceCapabilities,
} from "@/entities/record";
import {
  Badge,
  Button,
  ChecklistFacet,
  H4,
  Muted,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui";
import {
  activeRecordFilterCount,
  clearRecordFilters,
  facetValues,
  toggleRecordFacet,
} from "../model/urlState";
import { MinNumberFacet } from "./MinNumberFacet";
import { useRecordNavigation } from "./RecordNavigation";
import { TextFacet } from "./TextFacet";

// Access always lists all three values, even when the backend leaves a zero bucket out ("Restricted 0").
const accessOptions = (
  listed: readonly RecordFacetOption[],
): RecordFacetOption[] =>
  ACCESS_VALUES.map((value) => ({
    key: value,
    label: ACCESS_LABELS[value],
    count: listed.find((option) => option.key === value)?.count ?? 0,
  }));

type FacetsProps = {
  capabilities: RecordSourceCapabilities;
  facets: RecordSearchResult["facets"];
  // false = the options could not be loaded: say so instead of showing empty lists.
  facetsAvailable?: boolean;
};

const ChecklistBlock = ({
  spec,
  options,
}: {
  spec: FacetSpec;
  options: readonly RecordFacetOption[];
}) => {
  const { query, navigate } = useRecordNavigation();
  return (
    <ChecklistFacet
      title={spec.title}
      options={spec.name === "access" ? accessOptions(options) : options}
      selected={facetValues(query, spec.name)}
      onToggle={(key) => navigate(toggleRecordFacet(query, spec, key))}
      {...(spec.searchable && {
        searchPlaceholder: `Search ${spec.title.toLowerCase()}`,
      })}
    />
  );
};

// Everything here is driven by the source's capabilities: a facet the backend cannot apply is simply not in the list.
const FiltersPanel = ({
  capabilities,
  facets,
  facetsAvailable = true,
  hideHeader = false,
}: FacetsProps & { hideHeader?: boolean }) => {
  const { query, navigate } = useRecordNavigation();
  const active = activeRecordFilterCount(query);
  return (
    <div className="flex flex-col">
      {hideHeader ? null : (
        <div className="flex items-center justify-between pb-4">
          <div className="flex items-center gap-2">
            <H4 className="text-[15px] font-semibold">Filters</H4>
            {active > 0 ? (
              <Badge className="px-1.5 text-[11px]">{active}</Badge>
            ) : null}
          </div>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            disabled={active === 0}
            onClick={() => navigate(clearRecordFilters(query))}
          >
            Clear all
          </Button>
        </div>
      )}
      {facetsAvailable ? null : (
        <Muted className="pb-2 text-xs">
          Filter options are unavailable right now.
        </Muted>
      )}
      {capabilities.facets.map((spec) => {
        if (spec.kind === "text")
          return <TextFacet key={spec.name} spec={spec} />;
        if (spec.kind === "min-number")
          return <MinNumberFacet key={spec.name} spec={spec} />;
        return (
          <ChecklistBlock
            key={spec.name}
            spec={spec}
            options={facets[spec.name] ?? []}
          />
        );
      })}
    </div>
  );
};

// lg and up: the fixed column.
const RecordFiltersColumn = (props: FacetsProps) => (
  <aside aria-label="Filters" className="hidden w-60 shrink-0 lg:block">
    <FiltersPanel {...props} />
  </aside>
);

// Below lg: a "Filters (n)" button opens the same facets in a left sheet. Choices apply at once; the footer button closes it.
const RecordMobileFilters = ({
  total,
  ...props
}: FacetsProps & { total: number }) => {
  const { query, navigate } = useRecordNavigation();
  const [open, setOpen] = useState(false);
  const count = activeRecordFilterCount(query);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="lg:hidden max-lg:min-h-11"
        >
          Filters
          {count > 0 ? (
            <Badge className="px-1.5 text-[11px]">{count}</Badge>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="flex w-[min(22rem,100vw)] flex-col gap-0 p-0"
      >
        <SheetHeader className="border-border border-b">
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription className="sr-only">
            Narrow the simulations. Choices apply immediately.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4">
          <FiltersPanel {...props} hideHeader />
        </div>
        <SheetFooter className="border-border bg-background sticky bottom-0 flex-row items-center justify-between gap-3 border-t">
          <Button
            type="button"
            className="min-h-11 flex-1"
            onClick={() => setOpen(false)}
          >
            {`Show ${total} ${total === 1 ? "simulation" : "simulations"}`}
          </Button>
          <Button
            type="button"
            variant="link"
            className="min-h-11"
            onClick={() => navigate(clearRecordFilters(query))}
            disabled={count === 0}
          >
            Clear all
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export { RecordFiltersColumn, RecordMobileFilters };
