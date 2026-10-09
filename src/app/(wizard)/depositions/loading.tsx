import { Skeleton } from "@/shared/ui";

// Wizard frame while the draft loads (missing-states 2.5): sidebar with a title and step rows, page header and three
// accordion headers. Sits above the [draftId] layout because that layout is what waits for the draft.
const DepositionLoading = () => (
  <div className="bg-background flex min-h-screen" aria-busy="true">
    <aside className="border-border bg-surface hidden w-60 shrink-0 flex-col gap-6 border-r p-4 lg:flex xl:w-[268px]">
      <p className="text-[13.5px] font-bold">MDRepo</p>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-2.5 w-24" />
      </div>
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-center gap-2">
            <Skeleton className="size-3.5 rounded-full" />
            <Skeleton className="h-3 w-30" />
          </div>
        ))}
      </div>
    </aside>
    <main className="flex-1 px-4 pt-8 md:px-6 lg:px-12">
      <div className="mx-auto flex w-full max-w-160 flex-col gap-4">
        <div className="flex flex-col gap-2 pb-2">
          <Skeleton className="h-2.5 w-15" />
          <Skeleton className="h-6 w-60" />
          <Skeleton className="h-3 w-90 max-w-full" />
        </div>
        {[0, 1, 2].map((section) => (
          <Skeleton key={section} className="h-17 w-full rounded-lg" />
        ))}
      </div>
    </main>
  </div>
);

export default DepositionLoading;
