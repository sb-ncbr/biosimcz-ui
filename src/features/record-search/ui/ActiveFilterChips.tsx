"use client";

import { X } from "lucide-react";
import { ACCESS_LABELS } from "@/entities/deposition";
import type { FacetSpec, RecordSourceCapabilities } from "@/entities/record";
import { Badge, Button } from "@/shared/ui";
import {
  clearRecordFilters,
  facetValues,
  hasRecordFilters,
  toggleRecordFacet,
} from "../model/urlState";
import { useRecordNavigation } from "./RecordNavigation";

const valueLabel = (spec: FacetSpec, value: string): string =>
  spec.name === "access"
    ? ((ACCESS_LABELS as Record<string, string>)[value] ?? value)
    : value;

// One removable chip per selected value of a DECLARED facet (unknown URL keys never get here), plus "Clear all", which
// keeps the search, the sort and the page size.
const ActiveFilterChips = ({
  capabilities,
}: {
  capabilities: RecordSourceCapabilities;
}) => {
  const { query, navigate } = useRecordNavigation();
  if (!hasRecordFilters(query)) return null;
  return (
    <ul
      aria-label="Active filters"
      className="mt-3 flex flex-wrap items-center gap-2"
    >
      <li>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs"
          onClick={() => navigate(clearRecordFilters(query))}
        >
          Clear all
        </Button>
      </li>
      {capabilities.facets.flatMap((spec) =>
        facetValues(query, spec.name).map((value) => {
          const label = `${spec.title}: ${valueLabel(spec, value)}`;
          return (
            <li key={`${spec.name}:${value}`}>
              <Badge
                variant="secondary"
                className="gap-1 py-0.5 pr-1 pl-2 text-xs font-normal"
              >
                {label}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-6 rounded-full"
                  aria-label={`Remove filter ${label}`}
                  onClick={() =>
                    navigate(toggleRecordFacet(query, spec, value))
                  }
                >
                  <X className="size-3.5" aria-hidden />
                </Button>
              </Badge>
            </li>
          );
        }),
      )}
    </ul>
  );
};

export { ActiveFilterChips };
