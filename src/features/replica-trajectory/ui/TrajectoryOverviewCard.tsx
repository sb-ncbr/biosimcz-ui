import { formatQuantity, frequencyPs, type ReplicaDetail } from "@/entities/replica";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui";

const NOT_REPORTED = "N/A";

const TrajectoryOverviewCard = ({ replica }: { replica: ReplicaDetail }) => {
  const rows = [
    { label: "Frames", value: formatQuantity(replica.frames) },
    { label: "Frame step", value: formatQuantity(frequencyPs(replica.frameStepNs), "ps") },
    { label: "Atoms", value: formatQuantity(replica.atoms) },
    { label: "Type", value: replica.dataType },
  ];
  return (
    <Card className="min-w-0 justify-start">
      <CardHeader>
        <CardTitle className="text-[15px] font-semibold">Trajectory</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {rows.map(({ label, value }) => (
            <div key={label} className="bg-base-100 flex min-w-0 flex-col gap-0.5 rounded-lg px-3 py-2.5">
              <dt className="text-text-muted text-xs">{label}</dt>
              <dd className="text-base font-semibold break-words tabular-nums">{value ?? NOT_REPORTED}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
};

export { TrajectoryOverviewCard };
