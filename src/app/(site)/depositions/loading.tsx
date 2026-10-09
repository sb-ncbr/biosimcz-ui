import { Content, H1, Skeleton } from "@/shared/ui";

// missing-states 4.3: the header is real, the filters column and three draft cards are skeletons.
const DepositionsLoading = () => (
  <Content className="max-w-none space-y-0 lg:px-8 xl:px-12" aria-busy="true">
    <div className="flex items-center gap-4">
      <H1 className="text-3xl">My depositions</H1>
      <Skeleton className="h-8 w-19 rounded-md" />
    </div>
    <div className="mt-6 flex gap-8">
      <aside aria-hidden className="hidden w-55 shrink-0 flex-col gap-6 lg:flex xl:w-60">
        <Skeleton className="h-4 w-20" />
        {[0, 1, 2, 3, 4].map((block) => (
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
        <Skeleton className="mt-6 h-3 w-16" />
        <div className="mt-4 flex flex-col gap-4">
          {[0, 1, 2].map((card) => (
            <div key={card} className="border-border overflow-hidden rounded-xl border">
              <div className="flex gap-4 p-4">
                <Skeleton className="size-19 shrink-0 rounded-lg max-md:size-12" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-3 w-[30%]" />
                  <div className="border-border mt-3 flex gap-4 border-t pt-3">
                    {[0, 1, 2].map((step) => (
                      <div key={step} className="flex items-center gap-1.5">
                        <Skeleton className="size-3.5 rounded-full" />
                        <Skeleton className="h-2.5 w-20" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <Skeleton className="bg-base-50 h-9 w-full rounded-none" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </Content>
);

export default DepositionsLoading;
