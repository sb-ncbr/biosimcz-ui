"use client";

import { Badge, Command, CommandItem, CommandList } from "@e-infra/design-system";
import { Command as CommandPrimitive } from "cmdk";
import { X } from "lucide-react";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/shared/lib";

type TagInputProps = {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  // Accessible name. cmdk owns aria-labelledby on its input, so an external <label for> cannot name it.
  label: string;
  "aria-describedby"?: string;
  removeLabel?: (tag: string) => string;
  addLabel?: (text: string) => string;
  className?: string;
};

const sameTag = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

// Tags in a field-shaped box plus a suggestion list; Enter or comma commits the typed text.
const TagInput = ({
  value,
  onChange,
  suggestions = [],
  placeholder,
  id,
  disabled,
  label,
  removeLabel = (tag) => `Remove ${tag}`,
  addLabel = (text) => `Add "${text}"`,
  className,
  ...aria
}: TagInputProps) => {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const typed = text.trim();

  const options = useMemo(() => {
    const matches = suggestions.filter(
      (s) => !value.some((tag) => sameTag(tag, s)) && (typed === "" || s.toLocaleLowerCase().includes(typed.toLocaleLowerCase())),
    );
    const canAddTyped = typed !== "" && !value.some((tag) => sameTag(tag, typed));
    // The typed text goes first so Enter, which cmdk maps to the first item, adds exactly what was typed.
    return canAddTyped
      ? [{ key: "typed", tag: typed, label: addLabel(typed) }, ...matches.filter((m) => !sameTag(m, typed)).map((m) => ({ key: m, tag: m, label: m }))]
      : matches.map((m) => ({ key: m, tag: m, label: m }));
  }, [suggestions, value, typed, addLabel]);

  const commit = (tag: string) => {
    const next = tag.trim();
    if (next === "") return;
    // A duplicate is dropped but the box still clears, so the user is not left with stale text.
    if (!value.some((existing) => sameTag(existing, next))) onChange([...value, next]);
    setText("");
  };

  const remove = (tag: string) => {
    onChange(value.filter((existing) => existing !== tag));
    inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "," && typed !== "") {
      event.preventDefault();
      commit(typed);
    } else if (event.key === "Enter" && typed !== "" && options.length === 0) {
      // No list item exists for a duplicate, so cmdk would ignore Enter.
      event.preventDefault();
      commit(typed);
    } else if (event.key === "Backspace" && text === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <Command
      shouldFilter={false}
      label={label}
      className={cn("relative h-auto overflow-visible bg-transparent", className)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      {/* Clicking the padding focuses the input, like a native field. */}
      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          "border-border dark:bg-surface flex min-h-9 w-full cursor-text flex-wrap items-center gap-1.5 rounded-md border bg-transparent px-2 py-1.5 shadow-xs transition-[color,box-shadow]",
          "focus-within:border-border-focus focus-within:ring-border-focus focus-within:ring-2",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        {value.map((tag) => (
          <Badge key={tag} variant="outline" className="bg-surface gap-1 py-0.5 pr-1 pl-2 text-xs font-normal">
            {tag}
            <button
              type="button"
              disabled={disabled}
              aria-label={removeLabel(tag)}
              onClick={(event) => {
                event.stopPropagation();
                remove(tag);
              }}
              className="text-text-muted hover:text-text focus-visible:ring-border-focus -my-1 flex size-6 items-center justify-center rounded-full outline-none focus-visible:ring-2"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </Badge>
        ))}
        <CommandPrimitive.Input
          ref={inputRef}
          id={id}
          value={text}
          onValueChange={(next) => {
            setText(next);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          placeholder={value.length === 0 ? placeholder : undefined}
          aria-describedby={aria["aria-describedby"]}
          className="placeholder:text-text-muted min-w-24 flex-1 bg-transparent px-1 py-0.5 text-sm outline-none"
        />
      </div>
      {/* Always mounted, hidden when closed: cmdk points the input's aria-controls at this list, so it must exist. */}
      {/* Keep focus in the input while clicking an option. */}
      <div
        hidden={!(open && options.length > 0)}
        onMouseDown={(event) => event.preventDefault()}
        className="bg-background border-border absolute top-full z-50 mt-1 w-full rounded-md border shadow-md"
      >
        <CommandList>
          {options.map((option) => (
            <CommandItem key={option.key} value={option.key} onSelect={() => commit(option.tag)}>
              {option.label}
            </CommandItem>
          ))}
        </CommandList>
      </div>
    </Command>
  );
};

export { TagInput };
export type { TagInputProps };
