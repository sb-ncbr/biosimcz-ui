"use client";

import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@e-infra/design-system";
import { Controller, get, type FieldErrors, type Path } from "react-hook-form";
import { withCurrent } from "@/shared/lib";
import { NumberInput } from "@/entities/deposition/ui";
import type { ControlIds } from "@/entities/deposition/ui";
import type { RunForm, RunFormInput } from "../model/useRunForm";

// Thin Controller wrappers so every section reads its field paths as strings, like the registry does.
type FieldName = Path<RunFormInput>;

type ControlProps = { form: RunForm; name: string; ids: ControlIds; placeholder?: string };

const errorMessage = (errors: FieldErrors<RunFormInput>, name: string): string | undefined => {
  const message = (get(errors, name) as { message?: unknown } | undefined)?.message;
  return typeof message === "string" ? message : undefined;
};

const TextControl = ({ form, name, ids, placeholder }: ControlProps) => (
  <Controller
    control={form.control}
    name={name as FieldName}
    render={({ field }) => (
      <Input
        {...ids}
        value={typeof field.value === "string" ? field.value : ""}
        onChange={field.onChange}
        onBlur={field.onBlur}
        placeholder={placeholder}
        autoComplete="off"
      />
    )}
  />
);

type NumberControlProps = Omit<ControlProps, "placeholder"> & { unit?: string; integer?: boolean };

const NumberControl = ({ form, name, ids, unit, integer }: NumberControlProps) => (
  <Controller
    control={form.control}
    name={name as FieldName}
    render={({ field }) => (
      <NumberInput
        {...ids}
        value={typeof field.value === "number" ? field.value : null}
        onChange={field.onChange}
        onBlur={field.onBlur}
        endAdornment={unit}
        integer={integer}
      />
    )}
  />
);

type SelectControlProps = ControlProps & { options: readonly string[]; labels?: Record<string, string> };

// Radix Select reports "" while its options are not mounted yet; that is not a choice, so empty values are ignored.
const SelectControl = ({ form, name, ids, placeholder, options, labels }: SelectControlProps) => (
  <Controller
    control={form.control}
    name={name as FieldName}
    render={({ field }) => {
      const current = typeof field.value === "string" ? field.value : undefined;
      return (
        <Select value={current ?? ""} onValueChange={(next) => next && field.onChange(next)}>
          <SelectTrigger {...ids} className="w-full" onBlur={field.onBlur}>
            <SelectValue placeholder={placeholder}>{current ? (labels?.[current] ?? current) : null}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {withCurrent(options, current).map((option) => (
              <SelectItem key={option} value={option}>
                {labels?.[option] ?? option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }}
  />
);

export { errorMessage, NumberControl, SelectControl, TextControl };
