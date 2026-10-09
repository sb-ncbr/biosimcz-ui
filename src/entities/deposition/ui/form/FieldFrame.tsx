"use client";

import { Badge } from "@e-infra/design-system";
import { CircleAlert, FileText } from "lucide-react";
import { createContext, useContext, useId, type ReactNode } from "react";
import { fieldAnchor } from "../../model/sections";
import { cn } from "@/shared/lib";

type StepContextValue = {
  // After "Go to field" / Review / Publish the empty required fields say so (missing-states 3.1).
  showRequired: boolean;
  // Paths (relative to `system`, as in the registry) of required fields still empty.
  missing: ReadonlySet<string>;
  // File that prefilled a field path prefix, if any.
  sourceOf: (paths: readonly string[]) => string | undefined;
};

const StepContext = createContext<StepContextValue>({
  showRequired: false,
  missing: new Set(),
  sourceOf: () => undefined,
});

const useStepContext = (): StepContextValue => useContext(StepContext);

type ControlIds = {
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": true | undefined;
};

type FieldFrameProps = {
  sectionId: string;
  // Registry path; also the "Go to field" anchor.
  path: string;
  label: string;
  required?: boolean;
  // Unit or note after the label ("nm", "degrees", "Optional").
  labelNote?: string;
  hint?: ReactNode;
  // Error copy already mapped from the schema code.
  error?: string | undefined;
  // Required message shown in "show required" mode when the field is empty.
  requiredMessage?: string;
  // Field paths whose prefill provenance shows as the "from file" chip.
  sourcePaths?: readonly string[];
  // Composite fields (vectors, angles) are a labelled group instead of one labelled control.
  group?: boolean;
  className?: string;
  children: (ids: ControlIds) => ReactNode;
};

// Label row, control, hint and message in one layout so every field reads the same (batch-c P2, missing-states 3.2).
const FieldFrame = ({
  sectionId,
  path,
  label,
  required,
  labelNote,
  hint,
  error,
  requiredMessage,
  sourcePaths,
  group,
  className,
  children,
}: FieldFrameProps) => {
  const base = useId();
  const { showRequired, missing, sourceOf } = useStepContext();
  const controlId = `${base}-control`;
  const labelId = `${base}-label`;
  const hintId = `${base}-hint`;
  const messageId = `${base}-message`;
  const message = error ?? (showRequired && required && missing.has(path) ? (requiredMessage ?? `${label} is required.`) : undefined);
  const source = sourceOf(sourcePaths ?? [path]);
  const describedBy = [hint ? hintId : null, message ? messageId : null].filter(Boolean).join(" ") || undefined;
  const ids: ControlIds = {
    id: controlId,
    "aria-describedby": describedBy,
    "aria-invalid": message ? true : undefined,
  };

  const labelContent = (
    <>
      {label}
      {required ? (
        <span className="text-error-700 ml-1" aria-hidden="true">
          *
        </span>
      ) : null}
      {required ? <span className="sr-only"> required</span> : null}
    </>
  );

  return (
    <div
      id={fieldAnchor(sectionId, path)}
      role={group ? "group" : undefined}
      aria-labelledby={group ? labelId : undefined}
      aria-describedby={group ? describedBy : undefined}
      className={cn("scroll-mt-24 flex min-w-0 flex-col gap-1.5", className)}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {group ? (
          <span id={labelId} className="text-text text-xs font-semibold">
            {labelContent}
          </span>
        ) : (
          <label id={labelId} htmlFor={controlId} className="text-text text-xs font-semibold">
            {labelContent}
          </label>
        )}
        {labelNote ? <span className="text-text-muted text-[11px]">{labelNote}</span> : null}
        {source ? (
          <Badge variant="secondary" className="gap-1 px-1.5 text-[11px] font-medium">
            <FileText className="size-3" aria-hidden="true" />
            from {source}
          </Badge>
        ) : null}
      </div>
      {children(ids)}
      {hint ? (
        <p id={hintId} className="text-text-muted text-[11px] leading-4">
          {hint}
        </p>
      ) : null}
      {message ? (
        <p id={messageId} className="text-error-700 flex items-start gap-1 text-[12px] leading-4" role={error ? "alert" : undefined}>
          <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {message}
        </p>
      ) : null}
    </div>
  );
};

export { FieldFrame, StepContext, useStepContext };
export type { ControlIds, FieldFrameProps, StepContextValue };
