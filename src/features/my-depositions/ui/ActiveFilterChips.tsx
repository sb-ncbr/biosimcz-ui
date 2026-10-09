"use client";

import { X } from "lucide-react";
import { ACCESS_LABELS, FACET_NAMES, type DepositionFacets, type DepositionListQuery, type FacetName } from "@/entities/deposition";
import { Badge, Button } from "@/shared/ui";
import { clearFilters, hasActiveFilters, setDateRange, toggleFacetValue } from "../model/urlState";
import { useListNavigation } from "./ListNavigation";

const FACET_TITLES: Record<FacetName, string> = {
  access: "Access",
  community: "Community",
  structure: "Structure",
  engine: "Engine",
  author: "Author",
  funder: "Funder",
  keyword: "Keyword",
};

type Chip = { id: string; group: string; value: string; remove: (query: DepositionListQuery) => DepositionListQuery };

const valueLabel = (name: FacetName, key: string, facets: DepositionFacets): string => {
  if (name === "access") return (ACCESS_LABELS as Record<string, string>)[key] ?? key;
  return facets.options[name].find((option) => option.key === key)?.label ?? key;
};

const dateValue = (query: DepositionListQuery): string => {
  if (query.createdFrom && query.createdTo) return `${query.createdFrom} to ${query.createdTo}`;
  return query.createdFrom ? `from ${query.createdFrom}` : `until ${query.createdTo}`;
};

const buildChips = (query: DepositionListQuery, facets: DepositionFacets): Chip[] => [
  ...(query.createdFrom || query.createdTo
    ? [{ id: "date", group: "Date", value: dateValue(query), remove: (current: DepositionListQuery) => setDateRange(current, null, null) }]
    : []),
  ...FACET_NAMES.flatMap((name) =>
    query.facets[name].map((key) => ({
      id: `${name}:${key}`,
      group: FACET_TITLES[name],
      value: valueLabel(name, key, facets),
      remove: (current: DepositionListQuery) => toggleFacetValue(current, name, key),
    })),
  ),
];

// Chips of the applied filters with a remove button each, plus "Clear all" (102:11300). One scrolling row on phones.
const ActiveFilterChips = ({ facets }: { facets: DepositionFacets }) => {
  const { query, navigate } = useListNavigation();
  if (!hasActiveFilters(query)) return null;
  const chips = buildChips(query, facets);
  return (
    <div className="flex items-center gap-2 overflow-x-auto py-3 md:flex-wrap md:overflow-visible" role="group" aria-label="Active filters">
      {chips.map((chip) => (
        <Badge key={chip.id} variant="secondary" className="shrink-0 gap-1.5 py-1 pr-1 pl-2.5 text-xs font-normal">
          <span className="text-text-muted">{chip.group}:</span>
          <span className="font-medium">{chip.value}</span>
          <button
            type="button"
            aria-label={`Remove filter ${chip.group}: ${chip.value}`}
            onClick={() => navigate(chip.remove(query))}
            className="hover:bg-base-200 focus-visible:ring-border-focus/50 flex size-6 items-center justify-center rounded-full outline-none focus-visible:ring-[3px] max-md:size-8"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </Badge>
      ))}
      <Button type="button" variant="link" size="sm" className="h-auto shrink-0 p-0 text-xs" onClick={() => navigate(clearFilters(query))}>
        Clear all
      </Button>
    </div>
  );
};

export { ActiveFilterChips };
