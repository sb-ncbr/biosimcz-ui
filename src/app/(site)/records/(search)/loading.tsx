import { RecordSearchHeader } from "@/widgets/record-search-page";
import { Content, Skeleton } from "@/shared/ui";

// The header and the search form are real, the filters column and five cards are skeletons.
const RecordsLoading = () => (
  <Content className="max-w-none space-y-0 lg:px-8 xl:px-12" aria-busy="true">
    <RecordSearchHeader />
    <div className="mt-6 flex gap-16">
      <aside aria-hidden className="hidden w-60 shrink-0 flex-col gap-6 lg:flex">
        <Skeleton className="h-4 w-20" />
        {[0, 1, 2, 3].map((block) => (
          <div key={block} className="flex flex-col gap-2.5">
            <Skeleton className="h-3 w-25" />
            {[0, 1, 2].map((line) => (
              <Skeleton key={line} className="h-2.5 w-40" />
            ))}
          </div>
        ))}
      </aside>
      <div className="min-w-0 flex-1">
        <Skeleton className="h-9 w-full" />
        <div className="mt-4 flex flex-col gap-4">
          {[0, 1, 2, 3, 4].map((card) => (
            <div key={card} className="border-border overflow-hidden rounded-xl border">
              <div className="flex flex-col gap-2 p-4">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-[30%]" />
                <Skeleton className="h-3 w-4/5" />
              </div>
              <Skeleton className="bg-base-50 h-9 w-full rounded-none" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </Content>
);

export default RecordsLoading;
