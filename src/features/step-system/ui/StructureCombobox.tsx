"use client";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Skeleton,
} from "@e-infra/design-system";
import { ChevronDown, X } from "lucide-react";
import { useEffect, useId, useReducer, useRef, useState } from "react";
import type { System } from "@/entities/deposition";
import { cn } from "@/shared/lib";
import { Icon } from "@/shared/ui/icons";
import { MIN_QUERY_LENGTH, searchStructures, type StructureHit } from "../lib/structureSearch";
import type { ControlIds } from "@/entities/deposition/ui";

type Structure = NonNullable<System["startingStructure"]>;

type StructureComboboxProps = Partial<ControlIds> & {
  value: Structure | undefined;
  onChange: (value: Structure | undefined) => void;
  onBlur?: () => void;
};

type SearchState = {
  query: string;
  status: "idle" | "loading" | "done" | "error";
  hits: StructureHit[];
};
type SearchAction =
  | { type: "query"; query: string }
  | { type: "results"; query: string; hits: StructureHit[] }
  | { type: "failed"; query: string }
  | { type: "reset" };

const initialSearch: SearchState = { query: "", status: "idle", hits: [] };

const searchReducer = (state: SearchState, action: SearchAction): SearchState => {
  switch (action.type) {
    case "query":
      return {
        query: action.query,
        status: action.query.trim().length >= MIN_QUERY_LENGTH ? "loading" : "idle",
        hits: [],
      };
    // A slow answer for an older query must not replace the current one.
    case "results":
      return action.query === state.query ? { ...state, status: "done", hits: action.hits } : state;
    case "failed":
      return action.query === state.query ? { ...state, status: "error", hits: [] } : state;
    case "reset":
      return initialSearch;
  }
};

const SOURCE_LABEL = { pdb: "PDB", alphafold: "AlphaFold" } as const;

const tokenLabel = (value: Structure): { name: string; id: string } => ({
  name: value.title?.trim() || (value.source === "custom" ? "Custom structure" : (value.id ?? "")),
  id: value.source === "custom" ? "Custom" : value.source && value.id ? `${SOURCE_LABEL[value.source]} ${value.id}` : (value.id ?? ""),
});

// Popover + Command combobox (BA 3.3). Search is E-S1: mocked locally until the backend has it.
const StructureCombobox = ({ value, onChange, onBlur, ...ids }: StructureComboboxProps) => {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const [search, dispatch] = useReducer(searchReducer, initialSearch);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const controller = useRef<AbortController | undefined>(undefined);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      controller.current?.abort();
    },
    [],
  );

  const onQuery = (query: string) => {
    clearTimeout(timer.current);
    controller.current?.abort();
    dispatch({ type: "query", query });
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) return;
    timer.current = setTimeout(() => {
      const abort = new AbortController();
      controller.current = abort;
      searchStructures(trimmed, abort.signal).then(
        (result) => {
          if (abort.signal.aborted) return;
          dispatch(result.ok ? { type: "results", query, hits: result.hits } : { type: "failed", query });
        },
        () => dispatch({ type: "failed", query }),
      );
    }, 250);
  };

  const pick = (next: Structure) => {
    onChange(next);
    setOpen(false);
    dispatch({ type: "reset" });
  };

  const token = value && (value.id || value.source === "custom" || value.title) ? tokenLabel(value) : undefined;
  const q = search.query.trim();

  return (
    <div className="flex items-stretch gap-1">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            dispatch({ type: "reset" });
            onBlur?.();
          }
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-haspopup="listbox"
            {...ids}
            className={cn(
              "border-border bg-background focus-visible:border-border-focus focus-visible:ring-border-focus/50 flex min-h-10 min-w-0 flex-1 items-center justify-between gap-2 rounded-md border px-1.5 py-1 text-left text-sm shadow-xs outline-none focus-visible:ring-[3px]",
              ids["aria-invalid"] && "border-error",
            )}
          >
            {token ? (
              <span className="bg-surface border-border flex min-w-0 items-center gap-1.5 rounded-md border py-0.5 pr-2 pl-1">
                <Icon name="mol-thumb-22" className="size-5.5 shrink-0" />
                <span className="truncate text-xs font-semibold">{token.name}</span>
                {token.id ? <span className="text-text-muted shrink-0 text-[11px]">{token.id}</span> : null}
              </span>
            ) : (
              <span className="text-text-muted px-1.5">Search structure</span>
            )}
            <ChevronDown className="text-text-muted mr-1 size-3.5 shrink-0" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
          <Command shouldFilter={false}>
            <CommandInput placeholder="PDB or AlphaFold ID, or protein name" value={search.query} onValueChange={onQuery} />
            <CommandList id={listId}>
              {q.length < MIN_QUERY_LENGTH ? (
                <p className="text-text-muted px-3 py-4 text-xs">Type at least {MIN_QUERY_LENGTH} characters to search.</p>
              ) : null}
              {search.status === "loading" ? (
                <div role="status" aria-label="Searching" className="flex flex-col gap-2 p-3">
                  <span className="text-text-muted text-xs">Searching...</span>
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                </div>
              ) : null}
              {search.status === "error" ? (
                <p role="alert" className="text-text-muted px-3 py-4 text-xs">
                  Search is not available right now. You can enter a custom structure.
                </p>
              ) : null}
              {search.status === "done" && search.hits.length > 0 ? (
                <CommandGroup>
                  {search.hits.map((hit) => (
                    <CommandItem key={`${hit.source}-${hit.id}`} value={`${hit.source}-${hit.id}`} onSelect={() => pick(hit)}>
                      <span className="font-medium">{hit.title}</span>
                      <span className="text-text-muted ml-auto text-[11px]">
                        {SOURCE_LABEL[hit.source]} {hit.id}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {search.status === "done" && search.hits.length === 0 ? (
                <CommandEmpty>No structures match &quot;{q}&quot;.</CommandEmpty>
              ) : null}
              {q.length >= MIN_QUERY_LENGTH && search.status !== "loading" ? (
                <CommandGroup>
                  <CommandItem value="custom-structure" onSelect={() => pick({ source: "custom", title: q })}>
                    Use &quot;{q}&quot; as a custom structure
                  </CommandItem>
                </CommandGroup>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {token ? (
        <button
          type="button"
          aria-label="Clear starting structure"
          onClick={() => onChange(undefined)}
          className="text-text-muted hover:text-text focus-visible:ring-border-focus flex w-9 items-center justify-center rounded-md outline-none focus-visible:ring-2"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
};

export { StructureCombobox };
export type { StructureComboboxProps };
