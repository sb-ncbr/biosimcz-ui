"use client";

import {
  Badge,
  Button,
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@e-infra/design-system";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/shared/lib";
import { useLookups, type Organisation } from "../api/lookups";

type Picked = { name: string; rorId?: string | undefined };

type OrganisationPickerProps = {
  id?: string;
  label: string;
  value: Picked[];
  onChange: (next: Picked[]) => void;
  // Several chips (affiliations) or a single choice (funder).
  multiple?: boolean;
  placeholder: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

const useDebounced = (value: string): string => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), 200);
    return () => clearTimeout(timer);
  }, [value]);
  return debounced;
};

// Organisation search backed by the ROR lookup. Free text stays possible ("Use ... as typed") because not every
// affiliation has a ROR record.
const OrganisationPicker = ({ id, label, value, onChange, multiple = false, placeholder, ...aria }: OrganisationPickerProps) => {
  const lookups = useLookups();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query);
  const search = useQuery({
    queryKey: ["study", "organisations", debounced],
    queryFn: () => lookups.organisations(debounced),
    enabled: open,
  });

  const typed = query.trim();
  const results: Organisation[] = (search.data ?? []).filter((org) => !value.some((item) => item.name === org.name));
  const canUseTyped = typed !== "" && !value.some((item) => item.name.toLowerCase() === typed.toLowerCase()) && !results.some((org) => org.name.toLowerCase() === typed.toLowerCase());

  const pick = (item: Picked) => {
    onChange(multiple ? [...value, item] : [item]);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {multiple && value.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label={`Selected ${label.toLowerCase()}`}>
          {value.map((item) => (
            <li key={item.name}>
              <Badge variant="outline" className="bg-surface gap-1 py-0.5 pr-1 pl-2 text-xs font-normal">
                {item.name}
                <button
                  type="button"
                  aria-label={`Remove ${item.name}`}
                  onClick={() => onChange(value.filter((entry) => entry.name !== item.name))}
                  className="text-text-muted hover:text-text focus-visible:ring-border-focus -my-1 flex size-6 items-center justify-center rounded-full outline-none focus-visible:ring-2"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={label}
            {...aria}
            className={cn("h-auto min-h-9 w-full justify-between px-3 py-1.5 text-sm font-normal", aria["aria-invalid"] && "border-error")}
          >
            <span className={cn("truncate", (multiple || value.length === 0) && "text-text-muted")}>
              {multiple ? placeholder : (value[0]?.name ?? placeholder)}
            </span>
            <ChevronDown className="text-text size-3.5 shrink-0" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
          <Command shouldFilter={false}>
            <CommandInput value={query} onValueChange={setQuery} placeholder="Search organisations" aria-label={`Search ${label.toLowerCase()}`} />
            <CommandList>
              {search.isPending ? <p className="text-text-muted px-3 py-2 text-xs">Searching...</p> : null}
              {search.isError ? <p className="text-error-700 px-3 py-2 text-xs">Search is not available right now. You can enter a name.</p> : null}
              {!search.isPending && results.length === 0 && !canUseTyped ? <CommandEmpty>No organisations match.</CommandEmpty> : null}
              {results.map((org) => (
                <CommandItem key={org.rorId} value={org.rorId} onSelect={() => pick({ name: org.name, rorId: org.rorId })}>
                  <span className="flex flex-col">
                    <span>{org.name}</span>
                    <span className="text-text-muted text-[11px]">{org.rorId.replace("https://ror.org/", "ROR ")}</span>
                  </span>
                </CommandItem>
              ))}
              {canUseTyped ? (
                <CommandItem value={`typed-${typed}`} onSelect={() => pick({ name: typed })}>
                  Use &quot;{typed}&quot; as typed
                </CommandItem>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export { OrganisationPicker };
export type { OrganisationPickerProps, Picked };
