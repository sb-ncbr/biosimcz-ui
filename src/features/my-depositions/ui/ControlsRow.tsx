"use client";

import { Search } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { LIST_SORTS, type ListSort, type ListStatus } from "@/entities/deposition";
import { AdornedInput, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsList, TabsTrigger } from "@/shared/ui";
import { setSearch, setSort, setStatus } from "../model/urlState";
import { useListNavigation } from "./ListNavigation";

const SEARCH_DEBOUNCE_MS = 300;

const TABS: readonly { value: ListStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
];

// TODO(backend): only "Last updated" is drawn; the others are the sort values E-L1 lists.
const SORT_LABELS: Record<ListSort, string> = {
  updated_desc: "Last updated",
  updated_asc: "Oldest updated",
  created_desc: "Newest created",
  title_asc: "Title A-Z",
};

const isSort = (value: string): value is ListSort => LIST_SORTS.some((sort) => sort === value);
const isStatus = (value: string): value is ListStatus => TABS.some((tab) => tab.value === value);

const SearchBox = () => {
  const { query, navigate } = useListNavigation();
  const [text, setText] = useState(query.q);
  const [seenQuery, setSeenQuery] = useState(query.q);
  // Adjust during render when the URL changes underneath (Clear search, back button).
  if (seenQuery !== query.q) {
    setSeenQuery(query.q);
    if (text.trim() !== query.q) setText(query.q);
  }

  useEffect(() => {
    if (text.trim() === query.q) return;
    const timer = setTimeout(() => navigate(setSearch(query, text), "replace"), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, query, navigate]);

  return (
    <form
      role="search"
      className="min-w-0 max-md:w-full md:w-70"
      onSubmit={(event) => {
        event.preventDefault();
        if (text.trim() !== query.q) navigate(setSearch(query, text), "replace");
      }}
    >
      <AdornedInput
        type="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Search title, author etc."
        aria-label="Search depositions"
        maxLength={200}
        startAdornment={<Search className="size-4" aria-hidden />}
        containerClassName="bg-background"
      />
    </form>
  );
};

// Tabs, search and sort (102:11300). `mobileFilters` is the "Filters (n)" button, placed beside Sort below lg.
const ControlsRow = ({ mobileFilters }: { mobileFilters?: ReactNode }) => {
  const { query, navigate } = useListNavigation();
  return (
    <div className="border-border flex flex-col gap-3 border-b pb-3 md:flex-row md:flex-wrap md:items-center">
      <Tabs value={query.status} onValueChange={(value) => isStatus(value) && navigate(setStatus(query, value))} className="max-md:w-full">
        <TabsList className="max-md:w-full" aria-label="Status">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} aria-controls={undefined} className="max-md:flex-1">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="flex flex-col gap-3 md:ml-auto md:flex-row md:items-center">
        <SearchBox />
        <div className="flex items-center gap-2">
          <Select value={query.sort} onValueChange={(value) => isSort(value) && navigate(setSort(query, value))}>
            <SelectTrigger aria-label="Sort by" className="max-md:min-h-11 max-md:flex-1 md:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIST_SORTS.map((sort) => (
                <SelectItem key={sort} value={sort}>
                  {SORT_LABELS[sort]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {mobileFilters}
        </div>
      </div>
    </div>
  );
};

export { ControlsRow };
