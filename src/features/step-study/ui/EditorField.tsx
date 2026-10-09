import { Label } from "@e-infra/design-system";
import { CircleAlert } from "lucide-react";
import { useId, type ReactNode } from "react";
import { cn } from "@/shared/lib";

type EditorFieldProps = {
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string | null;
  className?: string;
  children: (control: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
};

// Field layout for the editor dialogs. They validate on save, so unlike the page fields the error is passed in.
const EditorField = ({ label, required, hint, error, className, children }: EditorFieldProps) => {
  const base = useId();
  const hintId = `${base}-hint`;
  const messageId = `${base}-message`;
  const describedBy = [hint ? hintId : null, error ? messageId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={base} className="text-xs font-semibold">
        {label}
        {required ? (
          <>
            <span aria-hidden="true" className="text-error-700 ml-0.5">
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        ) : null}
      </Label>
      {children({ id: base, describedBy, invalid: Boolean(error) })}
      {hint ? (
        <p id={hintId} className="text-text-muted text-[11px]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={messageId} className="text-error-700 flex items-start gap-1 text-xs">
          <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  );
};

export { EditorField };
