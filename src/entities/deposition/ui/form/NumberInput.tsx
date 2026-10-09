"use client";

import { useState, type ReactNode } from "react";
import { AdornedInput } from "@/shared/ui";
import type { ControlIds } from "./FieldFrame";

type NumberInputProps = Partial<ControlIds> & {
  // The form value: a number, NaN while the text is not a number, null (or undefined) when empty. Empty is null, not
  // undefined, because react-hook-form answers an undefined change with the field default.
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  onBlur?: () => void;
  name?: string;
  startAdornment?: ReactNode;
  endAdornment?: ReactNode;
  integer?: boolean;
  className?: string;
  containerClassName?: string;
};

type Parsed = number | null;

const toText = (value: Parsed): string => (value === null || Number.isNaN(value) ? "" : String(value));

// Parses what people paste ("33 940", "6,82"); anything else becomes NaN so the schema can say "not a number".
const parseNumber = (text: string): Parsed => {
  const cleaned = text
    .trim()
    .replace(/[\s\u00a0]/g, "")
    .replace(",", ".");
  if (cleaned === "") return null;
  return /^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/i.test(cleaned) ? Number(cleaned) : Number.NaN;
};

const same = (a: Parsed, b: Parsed): boolean => a === b || (a !== null && b !== null && Number.isNaN(a) && Number.isNaN(b));

// Keeps the raw text so "6." and "-" survive while typing; the form only sees the parsed value.
const NumberInput = ({ value: incoming, onChange, onBlur, integer, ...props }: NumberInputProps) => {
  const value: Parsed = incoming ?? null;
  const [text, setText] = useState(() => toText(value));
  const [seen, setSeen] = useState<Parsed>(value);

  // The value changed from outside (prefill, restore): show it, unless the text already means the same number.
  if (!same(seen, value)) {
    setSeen(value);
    if (!same(parseNumber(text), value)) setText(toText(value));
  }

  return (
    <AdornedInput
      {...props}
      type="text"
      inputMode={integer ? "numeric" : "decimal"}
      autoComplete="off"
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        const parsed = parseNumber(event.target.value);
        setSeen(parsed);
        onChange(parsed);
      }}
      onBlur={onBlur}
    />
  );
};

export { NumberInput };
export type { NumberInputProps };
