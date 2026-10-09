"use client";

import { ArrowLeft, ListChecks } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import type { SimulationType } from "@/entities/deposition";
import { Button, CountBadge, Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/shared/ui";
import { cn } from "@/shared/lib";
import type { WizardNavModel } from "../model/types";
import { SaveStatus } from "./SaveStatus";
import { WizardSidebar } from "./WizardSidebar";

type WizardTopBarProps = {
  nav: WizardNavModel;
  helpdeskHref?: string;
  // App menu (site links, account); owned by the site widgets and injected by the layout.
  menu?: ReactNode;
  onAddRun?: (type: SimulationType) => void;
  className?: string;
};

// Below lg the sidebar collapses into this sticky bar plus a "Steps" sheet (missing-states 7.1).
const WizardTopBar = ({ nav, helpdeskHref, menu, onAddRun, className }: WizardTopBarProps) => {
  const [open, setOpen] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const title = nav.draft.title?.trim();
  const required = nav.steps.reduce((sum, step) => sum + step.requiredLeft, 0);
  return (
    <header className={cn("bg-surface border-border sticky top-0 z-30 flex items-center gap-2 border-b px-2 py-2", className)}>
      <Button asChild variant="ghost" size="icon" className="size-11 shrink-0">
        <Link href={nav.backHref} aria-label="Back to My depositions">
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
      </Button>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm leading-5 font-bold", !title && "text-text-muted italic")}>{title || "Unnamed deposition"}</p>
        <SaveStatus save={nav.draft.save} />
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="h-11 shrink-0 gap-2 md:h-9">
            <ListChecks className="size-4" aria-hidden="true" />
            Steps
            <CountBadge count={required} />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-[min(320px,85vw)] gap-0 p-0 sm:max-w-none"
          onOpenAutoFocus={(event) => {
            // Land on the current step, not the first tabbable control (Add run); fall back to the title.
            event.preventDefault();
            const current = event.currentTarget instanceof HTMLElement ? event.currentTarget.querySelector<HTMLElement>('a[aria-current="page"]') : null;
            (current ?? titleRef.current)?.focus();
          }}
        >
          <SheetTitle ref={titleRef} tabIndex={-1} className="sr-only outline-none">Steps</SheetTitle>
          <SheetDescription className="sr-only">Jump to any step or run of this deposition.</SheetDescription>
          <WizardSidebar nav={nav} helpdeskHref={helpdeskHref} onAddRun={onAddRun} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      {menu}
    </header>
  );
};

export { WizardTopBar };
export type { WizardTopBarProps };
