"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui";

type PanelSelectOption = { value: string; label: string };

type PanelSelectProps = {
  label: string;
  value: string;
  options: readonly PanelSelectOption[];
  onChange: (value: string) => void;
};

// Always rendered, even without options: a select that vanishes on empty data cannot be used to switch back.
function PanelSelect({ label, value, options, onChange }: PanelSelectProps) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm">
      <span className="text-text-muted">{label}</span>
      <Select value={value} onValueChange={onChange} disabled={options.length === 0}>
        <SelectTrigger aria-label={label} className="min-h-11 w-full sm:w-56">
          <SelectValue placeholder="No options" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

export { PanelSelect };
export type { PanelSelectOption };
