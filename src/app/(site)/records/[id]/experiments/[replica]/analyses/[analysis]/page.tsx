import { notFound, redirect } from "next/navigation";
import { isAnalysisName } from "@/entities/analysis";
import { replicaHref } from "@/entities/replica";
import { AnalysisView } from "@/features/analysis-view";
import { decodeReplicaParam, loadReplicaContext } from "../../../_lib/loadReplica";

type AnalysisPageProps = { params: Promise<{ id: string; replica: string; analysis: string }> };

// The analysis and variant pickers render in the layout's `toolbar` slot (see @toolbar), next to the section buttons.
const AnalysisPage = async ({ params }: AnalysisPageProps) => {
  const { id, replica: replicaParam, analysis } = await params;
  if (!isAnalysisName(analysis)) notFound();
  const context = await loadReplicaContext(id, decodeReplicaParam(replicaParam));
  if (!context) notFound();
  const { accession, replica } = context;
  if (!replica.analyses.includes(analysis)) redirect(replicaHref(accession, replica.name, "analyses"));

  return (
    <AnalysisView
      key={`${replica.instanceId}/${analysis}`}
      instanceId={replica.instanceId}
      analysisName={analysis}
      frameStepNs={replica.frameStepNs}
      atoms={replica.atoms}
    />
  );
};

export default AnalysisPage;
