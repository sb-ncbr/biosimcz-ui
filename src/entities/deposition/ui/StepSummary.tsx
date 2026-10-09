import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib";
import { Badge, CountBadge } from "@/shared/ui";
import { DefinitionList, type DefinitionItem } from "./DefinitionList";
import { StepStatusIcon, type StepStatus } from "./StepStatusIcon";

type SummaryGroup = { title: string; items: DefinitionItem[] };

type StepSummaryProps = {
  id: string;
  title: string;
  status: StepStatus;
  requiredLeft: number;
  toFix: number;
  editHref: string;
  // Definition rows grouped under small labels (226:6195); steps with their own body (the runs table) use children.
  groups?: SummaryGroup[];
  children?: ReactNode;
  onEdit?: () => void;
  className?: string;
};

// One block of the review page (226:5484): grey header with status, title, pill and "Edit", then the values.
const StepSummary = ({ id, title, status, requiredLeft, toFix, editHref, groups, children, onEdit, className }: StepSummaryProps) => {
  const headingId = `${id}-heading`;
  return (
    <section id={id} aria-labelledby={headingId} className={cn("scroll-mt-24 flex flex-col", className)}>
      <div className="bg-base-100 flex items-center gap-2.5 rounded-lg px-4 py-3.5">
        <StepStatusIcon status={status} size={16} />
        <h2 id={headingId} className="text-[15px] font-semibold">
          {title}
        </h2>
        {toFix > 0 ? (
          <Badge variant="error" className="px-2 text-[11px] font-semibold">
            {toFix} to fix
          </Badge>
        ) : (
          <CountBadge count={requiredLeft} />
        )}
        <span className="flex-1" />
        <Link
          href={editHref}
          onClick={onEdit}
          aria-label={`Edit ${title}`}
          className="text-text-muted hover:text-text focus-visible:ring-border-focus rounded-sm px-1 text-[13px] font-medium outline-none focus-visible:ring-2"
        >
          Edit
        </Link>
      </div>
      <div className="flex flex-col gap-4 px-4 pt-3 pb-2 md:pl-[42px]">
        {groups?.map((group) => (
          <div key={group.title} role="group" aria-label={group.title} className="flex flex-col gap-1">
            <p className="text-text-muted text-xs font-semibold" aria-hidden="true">
              {group.title}
            </p>
            <DefinitionList items={group.items} />
          </div>
        ))}
        {children}
      </div>
    </section>
  );
};

export { StepSummary };
export type { StepSummaryProps, SummaryGroup };
