"use client";

import { Input } from "@e-infra/design-system";
import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/shared/lib";

type AdornedInputProps = Omit<ComponentProps<typeof Input>, "prefix"> & {
  // Short text before the value, e.g. "X" or "alpha".
  startAdornment?: ReactNode;
  // Unit after the value, e.g. "nm", "atoms".
  endAdornment?: ReactNode;
  // Interactive element inside the field, e.g. the "Generate DOI" chip button.
  trailing?: ReactNode;
  containerClassName?: string;
};

// The border and focus ring live on the wrapper so adornments sit inside one visual field.
const AdornedInput = ({
  startAdornment,
  endAdornment,
  trailing,
  containerClassName,
  className,
  "aria-describedby": describedBy,
  ...props
}: AdornedInputProps) => {
  const baseId = useId();
  const startId = `${baseId}-start`;
  const endId = `${baseId}-end`;
  const ids = [describedBy, startAdornment ? startId : null, endAdornment ? endId : null].filter(Boolean).join(" ");

  return (
    <div
      className={cn(
        "border-border dark:bg-surface flex min-h-9 w-full items-center gap-2 rounded-md border bg-transparent px-3 shadow-xs transition-[color,box-shadow]",
        "focus-within:border-border-focus focus-within:ring-border-focus focus-within:ring-2",
        "has-[input[aria-invalid=true]]:border-error has-[input[aria-invalid=true]]:ring-error/20",
        "has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50",
        containerClassName,
      )}
    >
      {startAdornment ? (
        <span id={startId} className="text-text-muted shrink-0 text-xs">
          {startAdornment}
        </span>
      ) : null}
      <Input
        {...props}
        aria-describedby={ids || undefined}
        className={cn(
          "h-auto min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 py-1.5 shadow-none focus-visible:ring-0 dark:bg-transparent",
          className,
        )}
      />
      {endAdornment ? (
        <span id={endId} className="text-text-muted shrink-0 text-xs">
          {endAdornment}
        </span>
      ) : null}
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
    </div>
  );
};

export { AdornedInput };
export type { AdornedInputProps };
