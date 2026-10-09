import { Skeleton } from "@/shared/ui";

// Only the tab content: the shell comes from the layout and stays on screen.
const ReplicaLoading = () => (
  <div aria-busy="true" className="flex flex-col gap-4">
    <Skeleton className="h-10 w-full sm:w-64" />
    <Skeleton className="h-105 w-full" />
  </div>
);

export default ReplicaLoading;
