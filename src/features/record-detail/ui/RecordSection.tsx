import type { ReactNode } from "react";
import { cn } from "@/shared/lib";
import { CountBadge } from "@/shared/ui";

type RecordSectionProps = {
  id: string;
  title: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

// Same block as the review page (226:5484): a quiet grey header bar with the title, then the values on the page surface.
const RecordSection = ({ id, title, count, action, children, className }: RecordSectionProps) => {
  const headingId = `${id}-heading`;
  return (
    <section id={id} aria-labelledby={headingId} className={cn("flex scroll-mt-24 flex-col", className)}>
      <div className="bg-base-100 flex min-h-12 items-center gap-2.5 rounded-lg px-4 py-2.5">
        <h2 id={headingId} className="text-[15px] font-semibold">
          {title}
        </h2>
        {count !== undefined ? <CountBadge count={count} variant="count" /> : null}
        <span className="flex-1" />
        {action}
      </div>
      <div className="flex min-w-0 flex-col gap-4 px-4 pt-4 pb-2">{children}</div>
    </section>
  );
};

export { RecordSection };
