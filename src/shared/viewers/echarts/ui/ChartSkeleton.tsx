import { Skeleton } from "@/shared/ui";

// The fixed height matches the loaded chart, so the page does not shift when data arrives.
function ChartSkeleton({ height }: { height: number }) {
  return <Skeleton role="status" aria-label="Loading chart" style={{ height }} className="w-full rounded-lg" />;
}

export { ChartSkeleton };
