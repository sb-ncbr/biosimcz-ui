"use client";

import {
  Alert,
  Button,
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Skeleton,
} from "@e-infra/design-system";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/shared/lib";
import { useLookups, type Community } from "../api/lookups";

type CommunityComboboxProps = {
  id: string;
  value: string | undefined;
  onChange: (communityId: string) => void;
  onBlur?: () => void;
  "aria-describedby"?: string | undefined;
  "aria-invalid"?: boolean;
};

// The logo endpoint is not available yet, so the tile carries the initial.
const Logo = ({ name }: { name: string }) => (
  <span aria-hidden="true" className="bg-base-200 text-text flex size-[18px] shrink-0 items-center justify-center rounded text-[10px] font-semibold">
    {name.charAt(0).toUpperCase()}
  </span>
);

const CommunityCombobox = ({ id, value, onChange, onBlur, ...aria }: CommunityComboboxProps) => {
  const lookups = useLookups();
  const [open, setOpen] = useState(false);
  const communities = useQuery({ queryKey: ["study", "communities"], queryFn: () => lookups.communities() });
  const list: Community[] = communities.data ?? [];
  const selected = list.find((community) => community.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          onBlur={onBlur}
          {...aria}
          className={cn("h-auto min-h-9 w-full justify-between gap-2 px-3 py-1.5 text-[13px] font-normal", aria["aria-invalid"] && "border-error")}
        >
          {selected ? (
            <span className="flex min-w-0 items-center gap-2">
              <Logo name={selected.name} />
              <span className="truncate">{selected.name}</span>
              <span className="text-text-muted hidden truncate text-[11px] sm:inline">{selected.url}</span>
            </span>
          ) : value ? (
            <span className="truncate">{value}</span>
          ) : (
            <span className="text-text-muted">Choose a community</span>
          )}
          <ChevronDown className="text-text size-3.5 shrink-0" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
        {communities.isError ? (
          <div className="p-2">
            <Alert variant="error">
              <div className="col-start-2 flex flex-col items-start gap-2">
                <p>Could not load communities.</p>
                <Button type="button" variant="outline" size="sm" onClick={() => void communities.refetch()}>
                  Try again
                </Button>
              </div>
            </Alert>
          </div>
        ) : communities.isPending ? (
          <div className="flex flex-col gap-2 p-3" role="status" aria-label="Loading communities">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        ) : list.length === 0 ? (
          <p className="text-text-muted p-3 text-sm">No communities available. Contact the helpdesk.</p>
        ) : (
          <Command>
            <CommandInput placeholder="Search communities" aria-label="Search communities" />
            <CommandList>
              <CommandEmpty>No communities match.</CommandEmpty>
              {list.map((community) => (
                <CommandItem
                  key={community.id}
                  value={`${community.name} ${community.url}`}
                  onSelect={() => {
                    onChange(community.id);
                    setOpen(false);
                  }}
                >
                  <Logo name={community.name} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{community.name}</span>
                    <span className="text-text-muted truncate text-[11px]">{community.url}</span>
                  </span>
                  {community.id === value ? <Check className="size-4" aria-hidden="true" /> : null}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
};

export { CommunityCombobox };
export type { CommunityComboboxProps };
