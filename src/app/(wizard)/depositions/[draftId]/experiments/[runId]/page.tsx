import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isDraftId, isRunId } from "@/entities/deposition";
import { RunScreen } from "../_components/RunScreen";

type RunPageProps = { params: Promise<{ draftId: string; runId: string }> };

// Run editor (191:23, 195:2572). Ids are validated here; the run itself comes from the client draft (see RunScreen).
const RunPage = async ({ params }: RunPageProps) => {
  const { draftId, runId } = await params;
  if (!isDraftId(draftId) || !isRunId(runId)) notFound();
  return <RunScreen runId={runId} />;
};

const metadata: Metadata = { title: "Run - New deposition | MDRepo" };

export { metadata };
export default RunPage;
