import type { ReplicaDetail } from "@/entities/replica";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui";
import { compositionRows, counterIonRows, forceFieldRows, simulationBoxRows, simulationParameterRows } from "../lib/rows";
import { CompositionCard } from "./cards/CompositionCard";
import { CounterIonsCard } from "./cards/CounterIonsCard";
import { ForceFieldCard } from "./cards/ForceFieldCard";
import { SimulationBoxCard } from "./cards/SimulationBoxCard";
import { SimulationParametersCard } from "./cards/SimulationParametersCard";

// Warnings come first: they qualify every number below them.
const Warnings = ({ warnings }: { warnings: readonly string[] }) => (
  <Alert variant="warning" role="region" aria-label="Warnings">
    <AlertTitle>Warnings</AlertTitle>
    <AlertDescription>
      <ul className="flex list-disc flex-col gap-1 pl-4">
        {warnings.map((warning, index) => (
          <li key={index} className="break-words">
            {warning}
          </li>
        ))}
      </ul>
    </AlertDescription>
  </Alert>
);

const ReplicaOverview = ({ replica }: { replica: ReplicaDetail }) => (
  <div className="flex min-w-0 flex-col gap-4">
    {replica.warnings.length > 0 ? <Warnings warnings={replica.warnings} /> : null}
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <ForceFieldCard rows={forceFieldRows(replica)} />
      <SimulationParametersCard rows={simulationParameterRows(replica)} />
      <SimulationBoxCard rows={simulationBoxRows(replica)} />
      <CompositionCard rows={compositionRows(replica)} className="md:col-span-2 xl:col-span-2" />
      <CounterIonsCard rows={counterIonRows(replica)} />
    </div>
  </div>
);

export { ReplicaOverview };
