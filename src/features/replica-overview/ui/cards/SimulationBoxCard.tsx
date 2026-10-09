import { Badge } from "@/shared/ui";
import type { BoxRows } from "../../lib/rows";
import { NOT_AVAILABLE } from "../../lib/rows";
import { OverviewCard, StatGrid } from "./OverviewCard";

const SimulationBoxCard = ({ rows }: { rows: BoxRows }) => (
  <OverviewCard title="Simulation Box">
    <div className="flex flex-col gap-1.5">
      <span className="text-text-muted text-xs">Box type</span>
      {rows.types.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {rows.types.map((type) => (
            <li key={type}>
              <Badge variant="secondary" className="px-2 py-1 text-xs font-normal">
                {type}
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-base font-semibold">{NOT_AVAILABLE}</span>
      )}
    </div>
    <StatGrid rows={rows.edges} className="grid-cols-1 @md:grid-cols-3" />
    <StatGrid rows={[rows.volume]} />
  </OverviewCard>
);

export { SimulationBoxCard };
