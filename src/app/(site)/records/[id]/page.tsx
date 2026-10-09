import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { isRecordId } from "@/entities/record";
import { RecordDetailView } from "@/features/record-detail";
import { getRecordRepository } from "@/server/repositories/record";

type RecordPageProps = { params: Promise<{ id: string }> };

// Public: no session is read. The id shape is checked first (accessions, replica ids, MDRepo ids); anything else cannot exist.
// cache(): generateMetadata and the page share one backend call per request.
const loadRecord = cache(async (id: string) => (isRecordId(id) ? getRecordRepository().get(id) : null));

const generateMetadata = async ({ params }: RecordPageProps): Promise<Metadata> => {
  const record = await loadRecord((await params).id);
  return { title: `${record?.title ?? "Record"} | MDRepo` };
};

const RecordPage = async ({ params }: RecordPageProps) => {
  const record = await loadRecord((await params).id);
  if (!record) notFound();
  return <RecordDetailView record={record} />;
};

export { generateMetadata };
export default RecordPage;
