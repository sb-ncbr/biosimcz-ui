"use client";

import { ACCESS_LABELS, ACCESS_VALUES, type DepositionFacets, type DepositionListQuery, type FacetName, type FacetOption } from "@/entities/deposition";
import { Badge, Button, ChecklistFacet, H4 } from "@/shared/ui";
import { activeFilterCount, clearFilters, toggleFacetValue } from "../../model/urlState";
import { DateFacet } from "./DateFacet";

type FiltersPanelProps = {
  query: DepositionListQuery;
  facets: DepositionFacets;
  onChange: (next: DepositionListQuery) => void;
  // The sheet has its own title and a sticky "Clear all".
  hideHeader?: boolean;
};

type FacetConfig = { name: FacetName; title: string; searchPlaceholder?: string; showKey?: boolean };

// Facet set of the final design 102:10726 (extended facets of 93:8300 are out of scope).
const FACETS: readonly FacetConfig[] = [
  { name: "access", title: "Access" },
  { name: "community", title: "Community", searchPlaceholder: "Search communities" },
  { name: "structure", title: "Structure", searchPlaceholder: "PDB ID or protein name", showKey: true },
  { name: "engine", title: "Engine" },
  { name: "author", title: "Authors", searchPlaceholder: "Search authors" },
  { name: "funder", title: "Funders", searchPlaceholder: "Search funders" },
  { name: "keyword", title: "Keywords", searchPlaceholder: "Search keywords" },
];

// Access always lists all three values, even when the backend leaves a zero bucket out ("Restricted 0").
const accessOptions = (listed: readonly FacetOption[]): FacetOption[] =>
  ACCESS_VALUES.map((value) => ({ key: value, label: ACCESS_LABELS[value], count: listed.find((option) => option.key === value)?.count ?? 0 }));

const FiltersPanel = ({ query, facets, onChange, hideHeader = false }: FiltersPanelProps) => {
  const active = activeFilterCount(query);
  return (
    <div className="flex flex-col">
      {hideHeader ? null : (
        <div className="flex items-center justify-between pb-4">
          <div className="flex items-center gap-2">
            <H4 className="text-[15px] font-semibold">Filters</H4>
            {active > 0 ? <Badge className="px-1.5 text-[11px]">{active}</Badge> : null}
          </div>
          <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" disabled={active === 0} onClick={() => onChange(clearFilters(query))}>
            Clear all
          </Button>
        </div>
      )}
      <DateFacet query={query} buckets={facets.created} onChange={onChange} />
      {FACETS.map((facet) => (
        <ChecklistFacet
          key={facet.name}
          title={facet.title}
          options={facet.name === "access" ? accessOptions(facets.options.access) : facets.options[facet.name]}
          selected={query.facets[facet.name]}
          onToggle={(key) => onChange(toggleFacetValue(query, facet.name, key))}
          {...(facet.searchPlaceholder !== undefined && { searchPlaceholder: facet.searchPlaceholder })}
          {...(facet.showKey !== undefined && { showKey: facet.showKey })}
        />
      ))}
    </div>
  );
};

export { FACETS, FiltersPanel };
export type { FacetConfig };
