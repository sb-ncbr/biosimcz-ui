import type { ReactNode } from "react";
import { cn } from "@/shared/lib";

type DefinitionItem = {
  term: string;
  // Several values stack with a small gap; undefined means the field is missing.
  description?: ReactNode | ReactNode[];
  missingText?: string;
};

type DefinitionListProps = {
  items: DefinitionItem[];
  className?: string;
};

const toArray = (value: DefinitionItem["description"]) => (Array.isArray(value) ? value : value === undefined ? [] : [value]);

// Review layout: fixed 160 px key column, flexible value column (batch-d, definition list row).
const DefinitionList = ({ items, className }: DefinitionListProps) => (
  <dl className={cn("grid grid-cols-1 gap-x-3 gap-y-1 text-sm sm:grid-cols-[160px_1fr] sm:gap-y-2", className)}>
    {items.map((item) => {
      const values = toArray(item.description);
      return (
        <div key={item.term} className="contents">
          <dt className="text-text-muted pt-2 sm:pt-0">{item.term}</dt>
          <dd className="flex min-w-0 flex-col gap-[3px] break-words">
            {values.length === 0 ? (
              <span className="text-text-muted italic">{item.missingText ?? "Not provided"}</span>
            ) : (
              values.map((value, index) => <span key={index}>{value}</span>)
            )}
          </dd>
        </div>
      );
    })}
  </dl>
);

export { DefinitionList };
export type { DefinitionItem, DefinitionListProps };
