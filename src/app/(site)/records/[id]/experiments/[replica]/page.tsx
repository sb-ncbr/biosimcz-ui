import { redirect } from "next/navigation";
import { replicaHref } from "@/entities/replica";
import { decodeReplicaParam } from "../_lib/loadReplica";

type ReplicaPageProps = { params: Promise<{ id: string; replica: string }> };

const ReplicaPage = async ({ params }: ReplicaPageProps) => {
  const { id, replica } = await params;
  redirect(replicaHref(id, decodeReplicaParam(replica), "overview"));
};

export default ReplicaPage;
