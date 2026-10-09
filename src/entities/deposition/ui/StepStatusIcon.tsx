import { Icon, type IconName } from "@/shared/ui/icons";
import { cn } from "@/shared/lib";

type StepStatus = "done" | "partial" | "todo" | "error";
type StepStatusIconSize = 14 | 16;

const DEFAULT_LABELS: Record<StepStatus, string> = {
  done: "Complete",
  partial: "In progress",
  todo: "Not started",
  error: "Needs attention",
};

// Only 14 px exists for the error glyph in the approved frames; it scales with CSS at 16.
const iconFor = (status: StepStatus, size: StepStatusIconSize): IconName => {
  switch (status) {
    case "done":
      return size === 16 ? "status-done-16" : "status-done-14";
    case "partial":
      return size === 16 ? "ring-16" : "ring-14";
    case "todo":
      return size === 16 ? "status-todo-16" : "status-todo-14";
    case "error":
      return "status-error-14";
  }
};

const TONE: Record<StepStatus, string> = {
  done: "text-success-600",
  partial: "text-text",
  todo: "text-base-300",
  error: "text-error-600",
};

type StepStatusIconProps = {
  status: StepStatus;
  size?: StepStatusIconSize;
  // Text alternative; colour and shape alone must not carry the state.
  label?: string;
  className?: string;
};

const StepStatusIcon = ({ status, size = 14, label, className }: StepStatusIconProps) => (
  <Icon
    name={iconFor(status, size)}
    label={label ?? DEFAULT_LABELS[status]}
    data-status={status}
    className={cn("shrink-0", size === 16 ? "size-4" : "size-3.5", TONE[status], className)}
  />
);

export { StepStatusIcon };
export type { StepStatus, StepStatusIconProps };
