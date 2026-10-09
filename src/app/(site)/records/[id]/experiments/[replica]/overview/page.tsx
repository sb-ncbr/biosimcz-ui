import { notFound } from "next/navigation";
import { ReplicaOverview } from "@/features/replica-overview";
import { decodeReplicaParam, loadReplicaContext } from "../../_lib/loadReplica";

const OverviewPage = async ({ params }: { params: Promise<{ id: string; replica: string }> }) => {
  const { id, replica } = await params;
  const context = await loadReplicaContext(id, decodeReplicaParam(replica));
  if (!context) notFound();
  return <ReplicaOverview replica={context.replica} />;
};

export default OverviewPage;
