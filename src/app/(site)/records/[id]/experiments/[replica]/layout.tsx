import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ReplicaShell } from "@/widgets/replica-shell";
import { decodeReplicaParam, loadReplicaContext } from "../_lib/loadReplica";

type ReplicaParams = { id: string; replica: string };

const generateMetadata = async ({ params }: { params: Promise<ReplicaParams> }): Promise<Metadata> => {
  const { id, replica } = await params;
  const context = await loadReplicaContext(id, decodeReplicaParam(replica));
  return { title: `${decodeReplicaParam(replica)} | ${context?.record.title ?? "Record"} | MDRepo` };
};

type ReplicaLayoutProps = { params: Promise<ReplicaParams>; children: ReactNode; toolbar: ReactNode };

// `toolbar` is the @toolbar parallel slot: the analysis pickers, shown in the same row as the section buttons.
const ReplicaLayout = async ({ params, children, toolbar }: ReplicaLayoutProps) => {
  const { id, replica } = await params;
  const context = await loadReplicaContext(id, decodeReplicaParam(replica));
  if (!context) notFound();
  return (
    <ReplicaShell
      accession={context.accession}
      recordTitle={context.record.title ?? context.accession}
      replicaName={context.replica.name}
      replicas={context.replicas}
      toolbar={toolbar}
    >
      {children}
    </ReplicaShell>
  );
};

export { generateMetadata };
export default ReplicaLayout;
