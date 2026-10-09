import Link from "next/link";
import type {
  RecordSearchQuery,
  RecordSearchResult,
  RecordSourceCapabilities,
} from "@/entities/record";
import {
  ActiveFilterChips,
  hasRecordFilters,
  NoMatches,
  NoRecords,
  RecordControls,
  RecordFiltersColumn,
  RecordMobileFilters,
  RecordNavigationProvider,
  RecordResults,
  RecordSearchForm,
} from "@/features/record-search";
import { Button, Content, H1 } from "@/shared/ui";

// The page title and, for loading.tsx and error.tsx, the search bar so search stays usable there.
const RecordSearchHeader = ({
  defaultValue = "",
}: {
  defaultValue?: string;
}) => (
  <>
    <H1 className="text-3xl">Repository of molecular dynamics simulations</H1>
    <div className="mt-6">
      <RecordSearchForm
        key={defaultValue}
        size="page"
        defaultValue={defaultValue}
      />
    </div>
  </>
);

type RecordSearchPageProps = {
  query: RecordSearchQuery;
  result: RecordSearchResult;
  capabilities: RecordSourceCapabilities;
};

// /records: the dataset search. Pure function of the parsed query and the repository result.
const RecordSearchPage = ({
  query,
  result,
  capabilities,
}: RecordSearchPageProps) => {
  const repositoryEmpty =
    result.total === 0 && query.q === "" && !hasRecordFilters(query);
  return (
    <Content className="max-w-none space-y-0 lg:px-8 xl:px-12">
      {repositoryEmpty ? (
        <>
          <RecordSearchHeader defaultValue={query.q} />
          <NoRecords
            deposit={
              <Button asChild size="sm">
                <Link href="/depositions">Deposit your data</Link>
              </Button>
            }
          />
        </>
      ) : (
        <RecordNavigationProvider query={query}>
          <H1 className="text-3xl">
            Repository of molecular dynamics simulations
          </H1>
          <div className="mt-6 flex gap-16">
            <RecordFiltersColumn
              capabilities={capabilities}
              facets={result.facets}
              facetsAvailable={result.facetsAvailable}
            />
            <div className="min-w-0 flex-1">
              <RecordSearchForm
                key={query.q}
                size="page"
                defaultValue={query.q}
              />
              <RecordControls
                total={result.total}
                capabilities={capabilities}
                mobileFilters={
                  <RecordMobileFilters
                    capabilities={capabilities}
                    facets={result.facets}
                    facetsAvailable={result.facetsAvailable}
                    total={result.total}
                  />
                }
              />
              <ActiveFilterChips capabilities={capabilities} />
              {result.items.length === 0 ? (
                <NoMatches query={query} capabilities={capabilities} />
              ) : (
                <RecordResults result={result} />
              )}
            </div>
          </div>
        </RecordNavigationProvider>
      )}
    </Content>
  );
};

export { RecordSearchHeader, RecordSearchPage };
