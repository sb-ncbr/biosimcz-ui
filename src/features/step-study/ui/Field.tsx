"use client";

import { Label } from "@e-infra/design-system";
import { CircleAlert } from "lucide-react";
import { useFormState } from "react-hook-form";
import type { ReactNode } from "react";
import { fieldAnchor } from "@/entities/deposition";
import { cn } from "@/shared/lib";
import { formatMessage, requiredMessage } from "../model/messages";
import { useStudy } from "./context";

type FieldControl = { id: string; describedBy: string | undefined; invalid: boolean };

type FieldProps = {
  sectionId: string;
  // Registry path; with sectionId it forms the "Go to field" anchor.
  path: string;
  label: string;
  required?: boolean;
  // Small text after the label ("In citation order", "Optional").
  note?: string;
  hint?: string;
  // Right-aligned action beside the label, e.g. "Clear all".
  action?: ReactNode;
  // "control": the label points at the input that carries the anchor id. "group": lists and radio cards; the wrapper
  // carries the anchor (focusable by "Go to field") and names the group.
  kind?: "control" | "group";
  groupRole?: "group" | null;
  // Message from outside the form state (lookups, list rows).
  error?: string | null;
  className?: string;
  children: (control: FieldControl) => ReactNode;
};

const getError = (errors: unknown, path: string): string | undefined => {
  let current: unknown = errors;
  for (const key of path.split(".")) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  const message = (current as { message?: unknown } | undefined)?.message;
  return typeof message === "string" ? message : undefined;
};

const Field = ({ sectionId, path, label, required, note, hint, action, kind = "control", groupRole = "group", error, className, children }: FieldProps) => {
  const { form, showRequired, missing } = useStudy();
  const { errors } = useFormState({ control: form.control });
  const anchor = fieldAnchor(sectionId, path);
  const labelId = `${anchor}-label`;
  const hintId = `${anchor}-hint`;
  const messageId = `${anchor}-message`;

  // Format problems win over "required": a half-typed value is a repair, not an omission.
  const message = error ?? formatMessage(getError(errors, path)) ?? (showRequired && missing.has(anchor) ? requiredMessage(path) : null);
  const describedBy = [hint ? hintId : null, message ? messageId : null].filter(Boolean).join(" ") || undefined;
  const control: FieldControl = { id: anchor, describedBy, invalid: message !== null };

  const labelContent = (
    <>
      {label}
      {required ? (
        <>
          <span aria-hidden="true" className="text-error-700 ml-0.5">
            *
          </span>
          <span className="sr-only"> (required)</span>
        </>
      ) : null}
    </>
  );

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline gap-2">
        {kind === "control" ? (
          <Label htmlFor={anchor} className="text-xs font-semibold">
            {labelContent}
          </Label>
        ) : (
          <span id={labelId} className="text-xs leading-none font-semibold">
            {labelContent}
          </span>
        )}
        {note ? <span className="text-text-muted text-[11px]">{note}</span> : null}
        {action ? <span className="ml-1">{action}</span> : null}
      </div>
      {kind === "group" ? (
        <div
          id={anchor}
          tabIndex={-1}
          role={groupRole ?? undefined}
          aria-labelledby={groupRole ? labelId : undefined}
          aria-describedby={describedBy}
          className="flex flex-col gap-2 outline-none"
        >
          {children(control)}
        </div>
      ) : (
        children(control)
      )}
      {hint ? (
        <p id={hintId} className="text-text-muted text-[11px]">
          {hint}
        </p>
      ) : null}
      {message ? (
        <p id={messageId} className="text-error-700 flex items-start gap-1 text-xs">
          <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {message}
        </p>
      ) : null}
    </div>
  );
};

export { Field };
export type { FieldControl, FieldProps };
