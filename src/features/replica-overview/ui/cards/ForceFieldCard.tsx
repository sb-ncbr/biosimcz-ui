import { Badge } from "@/shared/ui";
import type { ForceFieldRows } from "../../lib/rows";
import { NOT_AVAILABLE } from "../../lib/rows";
import { OverviewCard } from "./OverviewCard";

const ForceFieldCard = ({ rows }: { rows: ForceFieldRows }) => (
  <OverviewCard title="Force Field & Water Model">
    <div className="flex flex-col gap-1.5">
      <span className="text-text-muted text-xs">Force field</span>
      {rows.forceFields.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {rows.forceFields.map((field) => (
            <li key={field}>
              <Badge variant="secondary" className="px-2 py-1 text-xs font-normal">
                {field}
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-base font-semibold">{NOT_AVAILABLE}</span>
      )}
    </div>
    <div className="flex flex-col gap-1.5">
      <span className="text-text-muted text-xs">Water model</span>
      <span className="text-base font-semibold">{rows.waterModel}</span>
    </div>
  </OverviewCard>
);

export { ForceFieldCard };
