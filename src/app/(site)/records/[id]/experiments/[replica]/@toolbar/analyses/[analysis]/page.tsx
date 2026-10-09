import { baseOf, groupAnalyses, isAnalysisName, type AnalysisOption } from "@/entities/analysis";
import { AnalysisPicker } from "@/features/analysis-view";
import { getReplicaRepository } from "@/server/repositories/replica";
import { decodeReplicaParam, loadReplicaContext } from "../../../../_lib/loadReplica";

type ToolbarPageProps = { params: Promise<{ id: string; replica: string; analysis: string }> };

// Rendered into the layout's section-button row (parallel slot) so the pickers sit beside Overview / Trajectory / Analyses.
// The sibling page owns redirects and 404s; an unknown analysis simply renders no pickers here.
const AnalysisToolbarPage = async ({ params }: ToolbarPageProps) => {
  const { id, replica: replicaParam, analysis } = await params;
  if (!isAnalysisName(analysis)) return null;
  const context = await loadReplicaContext(id, decodeReplicaParam(replicaParam));
  if (!context || !context.replica.analyses.includes(analysis)) return null;
  const { accession, replica } = context;

  const base = baseOf(analysis);
  const hasVariants = groupAnalyses(replica.analyses).find((group) => group.baseId === base)?.hasVariants ?? false;
  // Labels are cosmetic: a failed options call falls back to labelOf in the picker instead of an error page.
  const options: AnalysisOption[] | null = hasVariants
    ? await getReplicaRepository()
        .analysisOptions(replica.instanceId, base)
        .catch(() => null)
    : null;

  return <AnalysisPicker accession={accession} replicaName={replica.name} analyses={replica.analyses} current={analysis} options={options} />;
};

export default AnalysisToolbarPage;
