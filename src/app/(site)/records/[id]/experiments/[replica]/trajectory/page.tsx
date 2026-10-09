import { notFound } from "next/navigation";
import { TrajectoryOverviewCard, TrajectoryWorkbench } from "@/features/replica-trajectory";
import { decodeReplicaParam, loadReplicaContext } from "../../_lib/loadReplica";

const TrajectoryPage = async ({ params }: { params: Promise<{ id: string; replica: string }> }) => {
  const { id, replica } = await params;
  const context = await loadReplicaContext(id, decodeReplicaParam(replica));
  if (!context) notFound();
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <TrajectoryOverviewCard replica={context.replica} />
      <TrajectoryWorkbench replica={context.replica} />
    </div>
  );
};

export default TrajectoryPage;
