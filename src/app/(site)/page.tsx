import type { Metadata } from "next";
import { parseRecordQuery } from "@/features/record-search";
import { getRecordRepository } from "@/server/repositories/record";
import { getCurrentSession } from "@/server/session";
import { HomePage, type HomeSummary } from "@/widgets/home-page";

const metadata: Metadata = { title: "Repository of computational chemistry experiments | MDRepo" };

const ENGINE_CHIPS = 4;

// The default /records query: it shares that page's cache entry, so the counts cost no extra backend call when warm.
// Any failure only hides the counts; the hero and its search never depend on the backend.
const loadSummary = async (): Promise<HomeSummary> => {
  try {
    const repository = getRecordRepository();
    const result = await repository.search(parseRecordQuery({}, repository.capabilities));
    const engines = [...(result.facets.software ?? [])]
      .filter((option) => option.count !== 0)
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
      .slice(0, ENGINE_CHIPS);
    return { total: result.repositoryTotal ?? result.total, engines };
  } catch {
    return null;
  }
};

const Home = async () => {
  const session = await getCurrentSession();
  return <HomePage signedIn={Boolean(session?.user)} summary={loadSummary()} />;
};

export { metadata };
export default Home;
