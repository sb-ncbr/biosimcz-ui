import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LIST_PAGE_SIZE, type DepositionList } from "@/entities/deposition";
import { NewDepositionButton } from "@/features/deposition-create";
import {
  ActiveFilterChips,
  ControlsRow,
  EmptyDepositions,
  FiltersColumn,
  hasActiveFilters,
  ListNavigationProvider,
  MobileFilters,
  NoResults,
  nowMs,
  parseListQuery,
  ResultGroups,
  ResultsPagination,
  ResultsRegion,
  serializeListQuery,
  setPage,
  type RawParams,
} from "@/features/my-depositions";
import { isApiError } from "@/server/http/errors";
import { loginHref } from "@/entities/session";
import { listMine } from "@/server/repositories/deposition";
import { nextCookieJar, requireSessionOrRedirect } from "@/server/session";
import { Content, H1 } from "@/shared/ui";

const metadata: Metadata = { title: "My depositions | MDRepo" };

const PATH = "/depositions";

// RSC: the URL is the state, so this page is a pure function of `searchParams` (plan 3.2, 7.1).
const DepositionsPage = async ({ searchParams }: { searchParams: Promise<RawParams> }) => {
  const query = parseListQuery(await searchParams);
  const here = `${PATH}${serializeListQuery(query)}`;
  // The proxy check alone is bypassable, so the page repeats it.
  await requireSessionOrRedirect(here);

  let list: DepositionList;
  try {
    // RSC renders cannot set cookies, so this jar is read-only; token refresh happens in the proxy.
    list = await listMine(await nextCookieJar(false), query);
  } catch (error) {
    if (isApiError(error) && error.kind === "auth") redirect(loginHref(here, { expired: true }));
    throw error;
  }

  // A stale link to a page that no longer exists (items were deleted): land on the last page instead of an empty list.
  if (list.items.length === 0 && list.total > 0 && query.page > 1) {
    redirect(`${PATH}${serializeListQuery(setPage(query, Math.ceil(list.total / list.size)))}`);
  }

  const ownsNothing = list.total === 0 && query.status === "all" && query.q === "" && !hasActiveFilters(query);
  const now = nowMs();

  return (
    <Content className="max-w-none space-y-0 lg:px-8 xl:px-12">
      <div className="flex items-center gap-4">
        <H1 className="text-3xl">My depositions</H1>
        <NewDepositionButton label="New" ariaLabel="New deposition" />
      </div>
      {ownsNothing ? (
        <EmptyDepositions action={<NewDepositionButton label="New deposition" size="default" />} />
      ) : (
        <ListNavigationProvider query={query}>
          <div className="mt-6 flex gap-8">
            <FiltersColumn facets={list.facets} total={list.total} />
            <div className="min-w-0 flex-1">
              <ControlsRow mobileFilters={<MobileFilters facets={list.facets} total={list.total} />} />
              <ActiveFilterChips facets={list.facets} />
              <ResultsRegion total={list.total}>
                {list.items.length === 0 ? (
                  <NoResults newDeposition={<NewDepositionButton label="New deposition" size="default" />} />
                ) : (
                  <>
                    <ResultGroups list={list} now={now} />
                    <ResultsPagination total={list.total} size={list.size || LIST_PAGE_SIZE} />
                  </>
                )}
              </ResultsRegion>
            </div>
          </div>
        </ListNavigationProvider>
      )}
    </Content>
  );
};

export { metadata };
export default DepositionsPage;
