import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { recordsHref } from "@/entities/record";
import { parseRecordQuery, setRecordPage, type RawParams } from "@/features/record-search";
import { getRecordRepository } from "@/server/repositories/record";
import { RecordSearchPage } from "@/widgets/record-search-page";

const metadata: Metadata = { title: "Search simulations | MDRepo" };

// Public: no session is read here. RSC: the URL is the state, so this page is a pure function of `searchParams`.
const RecordsPage = async ({ searchParams }: { searchParams: Promise<RawParams> }) => {
  const repository = getRecordRepository();
  const query = parseRecordQuery(await searchParams, repository.capabilities);
  const result = await repository.search(query);

  // A stale link to a page that no longer exists: land on the last page instead of an empty list.
  if (result.items.length === 0 && result.total > 0 && query.page > 1) {
    redirect(recordsHref(setRecordPage(query, Math.ceil(result.total / (result.size || 1)))));
  }

  return <RecordSearchPage query={query} result={result} capabilities={repository.capabilities} />;
};

export { metadata };
export default RecordsPage;
