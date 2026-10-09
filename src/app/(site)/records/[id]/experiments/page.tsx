import { notFound, redirect } from "next/navigation";
import { recordHref } from "@/entities/record";
import { replicaHref } from "@/entities/replica";
import { loadExperimentsRecord } from "./_lib/loadReplica";

type ExperimentsPageProps = { params: Promise<{ id: string }> };

const ExperimentsPage = async ({ params }: ExperimentsPageProps) => {
  const { id } = await params;
  const record = await loadExperimentsRecord(id);
  if (!record) notFound();
  const [first] = record.replicaNames;
  redirect(first ? replicaHref(record.accession, first, "overview") : recordHref(record.accession));
};

export default ExperimentsPage;
