"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Badge,
  Button,
  CountBadge,
  Icon,
  NavItem,
  Separator,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui";
import type { SimulationType } from "@/entities/deposition";
import { StepStatusIcon } from "@/entities/deposition/ui";
import { AddRunMenu } from "@/features/step-experiments";
import { cn } from "@/shared/lib";
import type { WizardNavEntry, WizardNavModel } from "../model/types";
import { SaveStatus } from "./SaveStatus";

const plural = (count: number, one: string) => `${count} ${one}${count === 1 ? "" : "s"}`;

// Right-hand meta of a row: to-fix beats required beats optional (missing-states 3.3).
const EntryMeta = ({ entry, run }: { entry: WizardNavEntry; run?: boolean }) => {
  if (entry.toFix && entry.toFix > 0) {
    return (
      <Badge variant="error" className="px-2 text-[11px] font-semibold">
        {entry.toFix} to fix
      </Badge>
    );
  }
  if (entry.requiredLeft > 0) {
    // Runs show a bare number in the final frames; the label keeps it readable for screen readers.
    return run ? (
      <Badge className="px-2 text-[11px] font-semibold" aria-label={`${plural(entry.requiredLeft, "required field")} left`}>
        {entry.requiredLeft}
      </Badge>
    ) : (
      <CountBadge count={entry.requiredLeft} />
    );
  }
  if (entry.optionalLeft > 0) {
    return run ? (
      <span className="text-text-muted text-[11px] whitespace-nowrap">+ {entry.optionalLeft}</span>
    ) : (
      <CountBadge count={entry.optionalLeft} variant="optional" />
    );
  }
  return null;
};

type EntryRowProps = { entry: WizardNavEntry; active: boolean; run?: boolean; onNavigate?: () => void };

const EntryRow = ({ entry, active, run, onNavigate }: EntryRowProps) => (
  <NavItem asChild isActive={active} className={cn("gap-2 py-1.5", run ? "text-[13px]" : "text-sm font-semibold")}>
    <Link href={entry.href} aria-current={active ? "page" : undefined} onClick={onNavigate}>
      <StepStatusIcon status={entry.status} />
      <span className="min-w-0 flex-1 truncate">{entry.label}</span>
      <EntryMeta entry={entry} run={run} />
    </Link>
  </NavItem>
);

const DraftBlock = ({ nav, onNavigate }: { nav: WizardNavModel; onNavigate?: () => void }) => {
  const title = nav.draft.title?.trim();
  return (
    <div className="flex items-start gap-1">
      <Button asChild variant="ghost" size="icon" className="-ml-2 size-11 shrink-0 lg:size-9">
        <Link href={nav.backHref} aria-label="Back to My depositions" onClick={onNavigate}>
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
      </Button>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-text-muted text-[10px] leading-3 font-medium tracking-wide uppercase">Draft deposition</p>
        <Tooltip>
          <TooltipTrigger asChild>
            <p className={cn("line-clamp-2 text-base leading-5 font-bold break-words", !title && "text-text-muted italic")}>
              {title || "Unnamed deposition"}
            </p>
          </TooltipTrigger>
          {title ? <TooltipContent side="right">{title}</TooltipContent> : null}
        </Tooltip>
        <SaveStatus save={nav.draft.save} className="mt-1" />
      </div>
    </div>
  );
};

type WizardSidebarProps = {
  nav: WizardNavModel;
  helpdeskHref?: string;
  // Called after any link inside is followed; the mobile Steps sheet closes on it.
  onNavigate?: () => void;
  // Without it the "Add run" row is not rendered (nothing could handle it).
  onAddRun?: (type: SimulationType) => void;
  className?: string;
};

// Body shared by the fixed desktop sidebar and the "Steps" sheet, so both stay identical.
const WizardSidebar = ({ nav, helpdeskHref, onNavigate, onAddRun, className }: WizardSidebarProps) => {
  const pathname = usePathname();
  const isCurrent = (href: string) => pathname === href;
  const help = "Need help? e-INFRA CZ helpdesk";
  return (
    <div className={cn("bg-surface text-text flex h-full flex-col", className)}>
      <SidebarHeader className="p-4">
        <p className="text-[13.5px] font-bold">MDRepo</p>
      </SidebarHeader>
      <SidebarHeader className="px-4 py-3">
        <DraftBlock nav={nav} onNavigate={onNavigate} />
      </SidebarHeader>
      <SidebarContent className="px-2.5 py-4">
        <nav aria-label="Deposition steps">
          <ul className="flex flex-col gap-1">
            {nav.steps.map((step) => (
              <li key={step.id}>
                <EntryRow entry={step} active={isCurrent(step.href)} onNavigate={onNavigate} />
                {step.runs ? (
                  <ul className="mt-0.5 flex flex-col gap-0.5 pl-[22px]" aria-label={`${step.label} runs`}>
                    {step.runs.map((run) => (
                      <li key={run.id}>
                        <EntryRow entry={run} run active={isCurrent(run.href)} onNavigate={onNavigate} />
                      </li>
                    ))}
                    {onAddRun ? (
                      <li>
                        <AddRunMenu
                          variant="ghost"
                          align="start"
                          chevron={false}
                          className="text-text-muted h-9 w-full justify-start gap-2 px-3 font-normal"
                          onAdd={(type) => {
                            onAddRun(type);
                            onNavigate?.();
                          }}
                        />
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
          <Separator className="my-2" />
          <NavItem asChild isActive={isCurrent(nav.review.href)} className="gap-2 text-sm font-semibold">
            <Link href={nav.review.href} aria-current={isCurrent(nav.review.href) ? "page" : undefined} onClick={onNavigate}>
              <Icon name="send-15" className="size-[15px] shrink-0" />
              <span className="flex-1">Review and publish</span>
              {nav.review.ready ? (
                <Badge variant="secondary" className="text-[11px]">
                  Ready
                </Badge>
              ) : null}
            </Link>
          </NavItem>
        </nav>
      </SidebarContent>
      <SidebarFooter className="text-text-muted p-4 text-[10.5px]">
        {helpdeskHref ? (
          <a href={helpdeskHref} className="underline underline-offset-2">
            {help}
          </a>
        ) : (
          <span>{help}</span>
        )}
      </SidebarFooter>
    </div>
  );
};

export { WizardSidebar };
export type { WizardSidebarProps };
