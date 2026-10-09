import type { Row } from "../../lib/rows";
import { OverviewCard, StatGrid } from "./OverviewCard";

const CounterIonsCard = ({ rows }: { rows: readonly Row[] }) => (
  <OverviewCard title="Counter-Ions">
    <StatGrid rows={rows} className="grid-cols-1 @md:grid-cols-3" />
  </OverviewCard>
);

export { CounterIonsCard };
