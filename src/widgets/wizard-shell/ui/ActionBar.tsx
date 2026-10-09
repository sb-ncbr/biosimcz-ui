"use client";

import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useId } from "react";
import { Button, Icon, Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui";
import { cn } from "@/shared/lib";
import type { PublishModel } from "../model/types";

type ActionBarProps = {
  publish: PublishModel;
  // Opens the confirm dialog (Phase 4.7); the shell never publishes by itself.
  onPublish?: () => void;
  // A click while Publish is blocked: the owner shows why (switches on "show required", focuses the Review box, or toasts).
  onBlocked?: () => void;
  className?: string;
};

// Publish is aria-disabled, never natively disabled: it stays focusable and can explain why it is blocked.
const ActionBar = ({ publish, onPublish, onBlocked, className }: ActionBarProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const reasonId = useId();
  const ready = publish.state === "ready";
  const publishing = publish.state === "publishing";
  const reason = publishing ? undefined : publish.reason;

  const handleClick = () => {
    if (ready) return onPublish?.();
    if (publishing) return;
    onBlocked?.();
    if (publish.blockedHref && pathname !== publish.blockedHref) router.push(publish.blockedHref);
  };

  const button = (
    <Button
      type="button"
      size="sm"
      aria-disabled={!ready}
      aria-describedby={reason ? reasonId : undefined}
      onClick={handleClick}
      className={cn("w-full md:w-auto", !ready && "bg-base-200 text-text-muted hover:bg-base-200 cursor-not-allowed shadow-none max-md:h-11")}
    >
      {publishing ? <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" /> : null}
      {publishing ? "Publishing..." : "Publish"}
      {publishing ? null : <Icon name="send-15" className="size-[15px]" />}
    </Button>
  );

  return (
    <div
      className={cn(
        "bg-surface border-border sticky bottom-0 z-20 flex justify-end border-t px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]",
        className,
      )}
    >
      {reason ? (
        <>
          <span id={reasonId} className="sr-only">
            {reason}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent side="top">{reason}</TooltipContent>
          </Tooltip>
        </>
      ) : (
        button
      )}
    </div>
  );
};

export { ActionBar };
export type { ActionBarProps };
