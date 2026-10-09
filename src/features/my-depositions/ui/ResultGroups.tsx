import type { DepositionList, DepositionListItem } from "@/entities/deposition";
import { Badge } from "@/shared/ui";
import { timeLabel } from "../model/format";
import { DepositionCard } from "./DepositionCard";

type ResultGroupsProps = { list: DepositionList; now: number };

const GROUPS = [
  { kind: "draft", label: "Draft" },
  { kind: "published", label: "Published" },
] as const;

// DRAFT then PUBLISHED, each with its count (102:11300). A group without items on this page is not drawn.
const ResultGroups = ({ list, now }: ResultGroupsProps) => (
  <div className="flex flex-col gap-12">
    {GROUPS.map(({ kind, label }) => {
      const items: DepositionListItem[] = list.items.filter((item) => item.kind === kind);
      if (items.length === 0) return null;
      const headingId = `group-${kind}`;
      // Group totals come from counts_by_status; the page only holds one slice of them.
      const total = list.counts[kind] || items.length;
      return (
        <section key={kind} aria-labelledby={headingId}>
          <h2 id={headingId} className="text-text-muted flex items-center gap-2 text-xs font-semibold tracking-wider uppercase">
            {label}
            <Badge variant="secondary" className="px-2 text-[11px] font-medium">
              {total}
            </Badge>
          </h2>
          <ul className="mt-4 flex flex-col gap-4">
            {items.map((item) => (
              <li key={item.id}>
                <DepositionCard item={item} timeLabel={timeLabel(item, now)} />
              </li>
            ))}
          </ul>
        </section>
      );
    })}
  </div>
);

export { ResultGroups };
