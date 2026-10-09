import type { Row } from "../../lib/rows";
import { OverviewCard, StatGrid } from "./OverviewCard";

const SimulationParametersCard = ({ rows }: { rows: readonly Row[] }) => (
  <OverviewCard title="Simulation Parameters">
    <StatGrid rows={rows} className="grid-cols-2" />
  </OverviewCard>
);

export { SimulationParametersCard };
