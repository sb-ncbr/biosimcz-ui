"use client";

import { Search } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/shared/lib";
import { Button, Checkbox } from "@e-infra/design-system";
import { AdornedInput } from "./AdornedInput";
import { FacetBlock } from "./FacetBlock";

// Structural on purpose: shared cannot import the entity types.
// count null = unknown: no number is rendered and the row stays selectable.
type FacetOptionLike = { key: string; label: string; count: number | null };

type ChecklistFacetProps = {
  title: string;
  options: readonly FacetOptionLike[];
  selected: readonly string[];
  onToggle: (key: string) => void;
  searchPlaceholder?: string;
  // Rows shown before "Show all N".
  limit?: number;
  // Structure rows carry the PDB id next to the name.
  showKey?: boolean;
};

// Selected values that the current response no longer lists stay visible so they can be unchecked; they show 0 only when
// the other rows carry counts.
const withSelected = (options: readonly FacetOptionLike[], selected: readonly string[]): FacetOptionLike[] => {
  const counted = options.some((option) => option.count !== null) ? 0 : null;
  return [...options, ...selected.filter((key) => !options.some((option) => option.key === key)).map((key) => ({ key, label: key, count: counted }))];
};

const ChecklistFacet = ({ title, options, selected, onToggle, searchPlaceholder, limit = 5, showKey = false }: ChecklistFacetProps) => {
  const baseId = useId();
  const [text, setText] = useState("");
  const [expanded, setExpanded] = useState(false);

  const all = withSelected(options, selected);
  const needle = text.trim().toLowerCase();
  const matching = needle ? all.filter((option) => `${option.label} ${option.key}`.toLowerCase().includes(needle)) : all;
  // A searched list shows every match; selected rows never hide behind "Show all".
  const visible = needle || expanded ? matching : matching.filter((option, index) => index < limit || selected.includes(option.key));
  const canExpand = !needle && matching.length > limit;

  return (
    <FacetBlock title={title} selectedCount={selected.length}>
      {searchPlaceholder ? (
        <AdornedInput
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          startAdornment={<Search className="size-3.5" aria-hidden />}
          containerClassName="mb-1 min-h-8"
          className="h-8 text-xs"
        />
      ) : null}
      {visible.length === 0 ? <p className="text-text-muted text-xs">{needle ? "No matches" : "No options"}</p> : null}
      <ul className="flex flex-col">
        {visible.map((option) => {
          const checked = selected.includes(option.key);
          const inactive = option.count === 0 && !checked;
          const id = `${baseId}-${option.key}`;
          return (
            <li key={option.key}>
              <label htmlFor={id} className={cn("flex min-h-7 cursor-pointer items-center gap-2 py-0.5 text-[13px]", inactive && "cursor-not-allowed")}>
                <Checkbox id={id} checked={checked} disabled={inactive} onCheckedChange={() => onToggle(option.key)} className="size-3.5" />
                <span className={cn("min-w-0 flex-1 truncate", inactive && "text-text-muted")}>
                  {option.label}
                  {showKey && option.label !== option.key ? <span className="text-text-muted ml-1.5 text-[10px]">{option.key}</span> : null}
                </span>
                {option.count === null ? null : <span className="text-text-muted text-xs tabular-nums">{option.count}</span>}
              </label>
            </li>
          );
        })}
      </ul>
      {canExpand ? (
        <Button type="button" variant="link" size="sm" className="h-auto justify-start p-0 text-xs" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Show fewer" : `Show all ${matching.length}`}
        </Button>
      ) : null}
    </FacetBlock>
  );
};

export { ChecklistFacet };
export type { ChecklistFacetProps, FacetOptionLike };
