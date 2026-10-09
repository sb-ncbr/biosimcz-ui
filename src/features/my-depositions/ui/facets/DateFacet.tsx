"use client";

import { Calendar } from "lucide-react";
import { useId, useState } from "react";
import type { DateBucket, DateGranularity, DepositionListQuery } from "@/entities/deposition";
import { AdornedInput, FacetBlock, FacetHistogram, ToggleGroup, ToggleGroupItem, type HistogramBar } from "@/shared/ui";
import { bucketRange, parseDateInput, setDateRange, setGranularity } from "../../model/urlState";

type DateFacetProps = {
  query: DepositionListQuery;
  buckets: readonly DateBucket[];
  onChange: (next: DepositionListQuery) => void;
};

const BAR_COUNT = 5;
const monthName = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });

// The backend answers with one bucket per month (E-L1 "created"); the year view sums them. Newest five bars, oldest first.
const toBars = (buckets: readonly DateBucket[], by: DateGranularity, query: DepositionListQuery): HistogramBar[] => {
  const grouped = new Map<string, number>();
  for (const bucket of buckets) {
    const key = by === "year" ? bucket.key.slice(0, 4) : bucket.key;
    if (by === "month" && key.length !== 7) continue;
    grouped.set(key, (grouped.get(key) ?? 0) + bucket.count);
  }
  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-BAR_COUNT)
    .map(([key, value]) => {
      const range = bucketRange(key);
      return {
        key,
        value,
        label: by === "year" ? key.slice(2) : monthName.format(new Date(`${key}-01T00:00:00Z`)),
        selected: range !== null && query.createdFrom === range.from && query.createdTo === range.to,
      };
    });
};

const caption = (query: DepositionListQuery): string => {
  if (query.createdFrom && query.createdTo) return `${query.createdFrom} to ${query.createdTo}`;
  if (query.createdFrom) return `From ${query.createdFrom}`;
  if (query.createdTo) return `Until ${query.createdTo}`;
  return "All time";
};

type DateInputProps = { label: string; placeholder: string; edge: "from" | "to"; value: string | null; onCommit: (iso: string | null) => void };

// Text stays free-form while typing; it is validated and normalised (year -> first or last day) on blur or Enter.
const DateInput = ({ label, placeholder, edge, value, onCommit }: DateInputProps) => {
  const [text, setText] = useState(value ?? "");
  const [seen, setSeen] = useState(value);
  const [invalid, setInvalid] = useState(false);
  // Adjust during render when the URL changes underneath (chip removed, Clear all).
  if (seen !== value) {
    setSeen(value);
    setText(value ?? "");
    setInvalid(false);
  }

  const commit = () => {
    const trimmed = text.trim();
    if (trimmed === "") {
      setInvalid(false);
      if (value !== null) onCommit(null);
      return;
    }
    const iso = parseDateInput(trimmed, edge);
    setInvalid(iso === null);
    if (iso === null) return;
    setText(iso);
    if (iso !== value) onCommit(iso);
  };

  return (
    <AdornedInput
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
      }}
      placeholder={placeholder}
      aria-label={label}
      aria-invalid={invalid || undefined}
      inputMode="numeric"
      trailing={<Calendar className="text-text-muted size-3.5" aria-hidden />}
      containerClassName="min-h-8 px-2"
      className="h-8 text-xs"
    />
  );
};

const DateFacet = ({ query, buckets, onChange }: DateFacetProps) => {
  const hintId = useId();
  const bars = toBars(buckets, query.by, query);
  const selectBar = (key: string) => {
    const range = bucketRange(key);
    if (!range) return;
    const already = query.createdFrom === range.from && query.createdTo === range.to;
    onChange(already ? setDateRange(query, null, null) : setDateRange(query, range.from, range.to));
  };

  return (
    <FacetBlock title="Date" selectedCount={query.createdFrom || query.createdTo ? 1 : 0}>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={query.by}
        onValueChange={(value) => {
          if (value === "year" || value === "month") onChange(setGranularity(query, value));
        }}
        aria-label="Group dates by"
        className="w-full"
      >
        <ToggleGroupItem value="year" className="flex-1 text-xs">
          Year
        </ToggleGroupItem>
        <ToggleGroupItem value="month" className="flex-1 text-xs">
          Month
        </ToggleGroupItem>
      </ToggleGroup>
      <p className="text-text-muted text-[11px]">{caption(query)}</p>
      {bars.length > 0 ? <FacetHistogram bars={bars} aria-label="Depositions by creation date" onBarClick={selectBar} className="h-auto" /> : null}
      <div className="flex items-center gap-1.5" aria-describedby={hintId} role="group" aria-label="Created between">
        <DateInput label="Created from" placeholder="From" edge="from" value={query.createdFrom} onCommit={(iso) => onChange(setDateRange(query, iso, query.createdTo))} />
        <span aria-hidden className="text-text-muted">
          -
        </span>
        <DateInput label="Created to" placeholder="To" edge="to" value={query.createdTo} onCommit={(iso) => onChange(setDateRange(query, query.createdFrom, iso))} />
      </div>
      <p id={hintId} className="text-text-muted text-[11px]">
        Year, month or day, e.g. 2025-03-09
      </p>
    </FacetBlock>
  );
};

export { DateFacet };
