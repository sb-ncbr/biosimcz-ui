"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { accessLabel, draftHref, licenseLabel, type DepositionListItem, type ProgressStep } from "@/entities/deposition";
import { StepStatusIcon } from "@/entities/deposition/ui";
import { recordHref } from "@/entities/record";
import { cn } from "@/shared/lib";
import { Badge, Card, CardContent, CardFooter, CountBadge, DoiChip, Icon, MetaItem } from "@/shared/ui";
import { structureLabel } from "../model/format";
import { CardMenu } from "./CardMenu";

type DepositionCardProps = {
  item: DepositionListItem;
  // Computed on the server so the client never renders relative times from its own clock.
  timeLabel: string;
};

const NO_TITLE = "Unnamed deposition";

const Dot = () => <span aria-hidden className="bg-base-300 size-[3px] shrink-0 rounded-full" />;

const Preview = ({ hasStructure }: { hasStructure: boolean }) => (
  <div
    aria-hidden
    className={cn(
      "flex size-19 shrink-0 items-center justify-center rounded-lg max-md:size-12",
      hasStructure ? "bg-base-100" : "border-border border border-dashed",
    )}
  >
    {hasStructure ? <Icon name="mol-thumb-22" className="size-2/3 rounded" /> : <Icon name="structure" className="text-text-muted size-6 max-md:size-4" />}
  </div>
);

const stepLabel = (step: ProgressStep, attention: boolean): ReactNode => (
  <li key={step.id} className={cn("flex items-center gap-1.5 text-xs", attention ? "text-text font-semibold" : "text-text-muted")}>
    <StepStatusIcon status={step.status} />
    {step.title}
  </li>
);

const SectionLabel = ({ children }: { children: ReactNode }) => (
  <span className="text-text-muted text-[10px] font-semibold tracking-wider uppercase">{children}</span>
);

const ProgressRow = ({ item }: { item: DepositionListItem }) => (
  <div className="border-border flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t pt-3">
    <SectionLabel>Progress</SectionLabel>
    <ul className="flex flex-wrap gap-x-3 gap-y-1.5">{item.progress?.steps.map((step) => stepLabel(step, step.id === item.progress?.attentionStep))}</ul>
  </div>
);

const AboutRow = ({ description }: { description: string | null }) => {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  return (
    <div className="border-border flex items-start gap-3 border-t pt-3">
      <SectionLabel>About</SectionLabel>
      {description ? (
        <>
          <p id={id} className={cn("text-text-muted min-w-0 flex-1 text-xs leading-relaxed", !expanded && "truncate")}>
            {description}
          </p>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={id}
            aria-label={expanded ? "Collapse description" : "Expand description"}
            onClick={() => setExpanded((value) => !value)}
            className="text-text-muted hover:text-text focus-visible:ring-border-focus/50 relative z-10 -my-1 flex size-6 shrink-0 items-center justify-center rounded-sm outline-none focus-visible:ring-[3px] max-md:size-9"
          >
            <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} aria-hidden />
          </button>
        </>
      ) : (
        <p className="text-text-muted text-xs">No description</p>
      )}
    </div>
  );
};

const DepositionCard = ({ item, timeLabel }: DepositionCardProps) => {
  const isDraft = item.kind === "draft";
  const name = item.title ?? NO_TITLE;
  const href = isDraft ? draftHref(item.id) : recordHref(item.id);
  const structure = structureLabel(item.structure);
  const access = accessLabel(item);
  const license = licenseLabel(item.license);
  const requiredLeft = item.progress?.requiredLeft ?? 0;
  const badge = isDraft ? (
    <CountBadge count={requiredLeft} variant="required" />
  ) : item.version !== null ? (
    <Badge variant="secondary" className="px-2">
      v{item.version}
    </Badge>
  ) : null;

  const hasChips = isDraft ? requiredLeft > 0 : badge !== null || item.doi !== null;

  return (
    <Card className="border-border focus-within:ring-border-focus/40 relative gap-0 overflow-hidden rounded-xl border py-0 drop-shadow-none focus-within:ring-2" data-kind={item.kind}>
      <CardContent className="flex gap-4 p-4 pb-3.5 max-md:gap-3">
        <Preview hasStructure={structure !== null} />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
            <div className="min-w-0 flex-1 max-md:basis-[calc(100%-3.5rem)]">
              <h3 className="text-[15px] leading-snug font-semibold">
                <Link href={href} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
                  {item.title ? name : <em className="text-text-muted font-medium">{NO_TITLE}</em>}
                </Link>
              </h3>
              <p className="text-text-muted mt-0.5 text-xs">{item.authors.length > 0 ? item.authors.join(", ") : "No authors yet"}</p>
            </div>
            {hasChips ? (
              <div className="flex items-center gap-2 max-md:order-2 max-md:basis-full">
                {!isDraft && item.doi ? <DoiChip doi={item.doi} /> : null}
                {badge}
              </div>
            ) : null}
            <div className="max-md:order-1">
              <CardMenu item={item} name={name} />
            </div>
          </div>
          {isDraft ? <ProgressRow item={item} /> : <AboutRow description={item.description} />}
        </div>
      </CardContent>
      <CardFooter className="border-border bg-base-50 flex-wrap gap-x-2.5 gap-y-1 border-t px-4 py-2.5 text-xs">
        <MetaItem icon="structure" label={structure ?? "No structure"} muted={structure === null} />
        <Dot />
        <MetaItem icon={item.access === "open" ? "access-open" : "access-embargoed"} label={access ?? "Access not set"} muted={access === null} />
        <Dot />
        <MetaItem icon="license" label={license ?? "License not set"} muted={license === null} />
        <span className="text-text-muted ml-auto text-[11px]">{timeLabel}</span>
      </CardFooter>
    </Card>
  );
};

export { DepositionCard };
export type { DepositionCardProps };
