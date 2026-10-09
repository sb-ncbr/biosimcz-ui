import type { ReactNode } from "react";
import { H1, Muted, Small } from "@/shared/ui";
import { cn } from "@/shared/lib";

type WizardColumnProps = {
  // form = 640 px column; wide = 728 px for the runs table (186:1099).
  width?: "form" | "wide";
  children: ReactNode;
  className?: string;
};

const WizardColumn = ({ width = "form", children, className }: WizardColumnProps) => (
  <div className={cn("mx-auto flex w-full flex-col gap-4", width === "wide" ? "max-w-182" : "max-w-160", className)}>{children}</div>
);

type WizardPageHeaderProps = {
  eyebrow: string;
  title: string;
  lead?: string;
  // Breadcrumb or step counter placed above the title.
  before?: ReactNode;
  // Inline hint after the title, e.g. "4 of 6".
  titleMeta?: string;
  actions?: ReactNode;
};

const WizardPageHeader = ({ eyebrow, title, lead, before, titleMeta, actions }: WizardPageHeaderProps) => (
  <header className="flex flex-wrap items-end justify-between gap-4 pb-2">
    <div className="min-w-0">
      {before}
      <Small className="text-text-muted block text-[11px]">{eyebrow}</Small>
      <H1 className="text-2xl font-bold">
        {title}
        {titleMeta ? <span className="text-text-muted ml-2 text-[13px] font-normal">{titleMeta}</span> : null}
      </H1>
      {lead ? <Muted className="text-[13px]">{lead}</Muted> : null}
    </div>
    {actions}
  </header>
);

export { WizardColumn, WizardPageHeader };
export type { WizardColumnProps, WizardPageHeaderProps };
