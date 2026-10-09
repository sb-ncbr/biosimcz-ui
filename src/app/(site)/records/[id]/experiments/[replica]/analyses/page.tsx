import { notFound, redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { groupAnalyses } from "@/entities/analysis";
import { replicaHref } from "@/entities/replica";
import { Card } from "@/shared/ui";
import { decodeReplicaParam, loadReplicaContext } from "../../_lib/loadReplica";

type AnalysesPageProps = { params: Promise<{ id: string; replica: string }> };

const AnalysesPage = async ({ params }: AnalysesPageProps) => {
  const { id, replica } = await params;
  const context = await loadReplicaContext(id, decodeReplicaParam(replica));
  if (!context) notFound();
  const first = groupAnalyses(context.replica.analyses)[0]?.variants[0];
  if (first) redirect(replicaHref(context.accession, context.replica.name, "analyses", first));
  return (
    <Card className="flex flex-col p-4">
      <div className="border-border text-text-muted flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 text-center">
        <BarChart3 className="size-12 opacity-50" aria-hidden="true" />
        <p className="text-sm">No analyses are available for this experiment yet.</p>
      </div>
    </Card>
  );
};

export default AnalysesPage;
