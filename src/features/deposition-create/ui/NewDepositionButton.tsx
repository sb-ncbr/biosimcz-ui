"use client";

import { Loader2, Plus } from "lucide-react";
import { useTransition, type ComponentProps } from "react";
import { toast } from "sonner";
import { cn } from "@/shared/lib";
import { Button } from "@/shared/ui";
import { createDraft } from "../actions";

type NewDepositionButtonProps = {
  label?: string;
  // Read by screen readers when the visible label is hidden (icon-only on phones).
  ariaLabel?: string;
  size?: ComponentProps<typeof Button>["size"];
  variant?: ComponentProps<typeof Button>["variant"];
  hideLabelBelowMd?: boolean;
  className?: string;
};

// Creates an empty draft and lands in the wizard (the action redirects). While it runs the button stays in place
// (aria-disabled, no layout jump); a failure shows a toast with Retry (missing-states 4.4).
const NewDepositionButton = ({ label = "New", ariaLabel, size = "sm", variant, hideLabelBelowMd = false, className }: NewDepositionButtonProps) => {
  const [pending, startTransition] = useTransition();

  const start = () => {
    startTransition(async () => {
      const result = await createDraft();
      if (!result.ok) toast.error("Could not start a deposition. Try again.", { action: { label: "Retry", onClick: () => start() } });
    });
  };

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      aria-label={ariaLabel}
      aria-disabled={pending}
      onClick={() => {
        if (!pending) start();
      }}
      className={cn("aria-disabled:pointer-events-none aria-disabled:opacity-70", className)}
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
      <span className={cn(hideLabelBelowMd && "max-md:hidden")}>{pending ? "Creating..." : label}</span>
    </Button>
  );
};

export { NewDepositionButton };
export type { NewDepositionButtonProps };
