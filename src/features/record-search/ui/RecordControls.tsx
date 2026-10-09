"use client";

import type { ReactNode } from "react";
import {
  RECORD_SORTS,
  type RecordSort,
  type RecordSourceCapabilities,
} from "@/entities/record";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui";
import { setRecordSize, setRecordSort } from "../model/urlState";
import { useRecordNavigation } from "./RecordNavigation";

const SORT_LABELS: Record<RecordSort, string> = {
  bestmatch: "Best match",
  newest: "Newest first",
  oldest: "Oldest first",
  title: "Title A-Z",
};

const isSort = (value: string): value is RecordSort =>
  RECORD_SORTS.some((sort) => sort === value);

// Result count on the left; sort, page size and (below lg) the Filters button on the right. The Selects come from the
// source's capabilities, and a Select with a single choice is not rendered.
const RecordControls = ({
  total,
  capabilities,
  mobileFilters,
}: {
  total: number;
  capabilities: RecordSourceCapabilities;
  mobileFilters?: ReactNode;
}) => {
  const { query, navigate } = useRecordNavigation();
  return (
    <div className="border-border mt-6 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
      <p className="text-sm font-semibold">
        {total === 0
          ? "No simulations"
          : `${total.toLocaleString("en")} ${total === 1 ? "simulation" : "simulations"}`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {capabilities.sorts.length > 1 ? (
          <>
            <span className="text-text-muted text-sm max-md:sr-only">
              Sort by
            </span>
            <Select
              value={query.sort}
              onValueChange={(value) =>
                isSort(value) && navigate(setRecordSort(query, value))
              }
            >
              <SelectTrigger
                aria-label="Sort by"
                className="max-md:min-h-11 md:w-40"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {capabilities.sorts.map((sort) => (
                  <SelectItem key={sort} value={sort}>
                    {SORT_LABELS[sort]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        ) : null}
        {capabilities.sizes.length > 1 ? (
          <>
            <span className="text-text-muted ml-2 text-sm max-md:sr-only">
              Per page
            </span>
            <Select
              value={String(query.size)}
              onValueChange={(value) =>
                navigate(setRecordSize(query, Number(value)))
              }
            >
              <SelectTrigger
                aria-label="Per page"
                className="max-md:min-h-11 md:w-20"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {capabilities.sizes.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        ) : null}
        {mobileFilters}
      </div>
    </div>
  );
};

export { RecordControls };
