import { Button } from "@e-infra/design-system";
import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib";
import { Icon } from "../icons";

type GhostSectionProps = {
  title: string;
  description: string;
  addLabel?: string;
  onAdd: () => void;
  className?: string;
};

// Optional section that is not part of the draft yet; the dashed border marks it as "not there".
const GhostSection = ({ title, description, addLabel = "Add", onAdd, className }: GhostSectionProps) => (
  <div className={cn("bg-surface/40 border-border flex items-center gap-3 rounded-lg border border-dashed px-4 py-3.5", className)}>
    <Icon name="status-todo-16" className="text-base-300 size-4 shrink-0" />
    <div className="min-w-0 flex-1">
      <p className="text-text-muted text-[15px] leading-[18px] font-semibold">{title}</p>
      <p className="text-text-muted text-xs">{description}</p>
    </div>
    <Button type="button" variant="ghost" size="sm" onClick={onAdd} aria-label={`${addLabel} ${title}`} className="text-primary shrink-0">
      <Plus className="size-3.5" aria-hidden="true" />
      {addLabel}
    </Button>
  </div>
);

type GhostSectionListProps = {
  heading?: string;
  children: ReactNode;
  className?: string;
};

const GhostSectionList = ({ heading = "Sections you can add", children, className }: GhostSectionListProps) => (
  <section aria-label={heading} className={cn("flex flex-col gap-2", className)}>
    <h3 className="text-text-muted text-[10px] font-semibold tracking-wider uppercase">{heading}</h3>
    {children}
  </section>
);

export { GhostSection, GhostSectionList };
export type { GhostSectionListProps, GhostSectionProps };
