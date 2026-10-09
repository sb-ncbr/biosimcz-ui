import { cn } from "@/shared/lib";

type HistogramBar = {
  key: string;
  label: string;
  value: number;
  selected?: boolean;
};

type FacetHistogramProps = {
  bars: HistogramBar[];
  "aria-label": string;
  // Log scale keeps small buckets visible on wide ranges such as simulation length.
  scale?: "linear" | "log";
  height?: number;
  onBarClick?: (key: string) => void;
  className?: string;
};

const scaleValue = (value: number, max: number, scale: "linear" | "log") => {
  if (value <= 0 || max <= 0) return 0;
  return scale === "log" ? Math.log10(value + 1) / Math.log10(max + 1) : value / max;
};

// Plain bars, no chart library: the design shows a mini histogram, not an interactive chart.
const FacetHistogram = ({ bars, scale = "linear", height = 56, onBarClick, className, ...rest }: FacetHistogramProps) => {
  const max = Math.max(0, ...bars.map((bar) => bar.value));
  return (
    <div role="group" aria-label={rest["aria-label"]} className={cn("flex gap-[3px]", className)}>
      {bars.map((bar) => {
        const ratio = scaleValue(bar.value, max, scale);
        const description = `${bar.label}: ${bar.value}`;
        const visual = (
          <span
            aria-hidden="true"
            className={cn("block w-full rounded-t-[3px]", bar.selected ? "bg-primary" : "bg-base-200")}
            style={{ height: `${Math.max(ratio * 100, bar.value > 0 ? 4 : 0)}%` }}
          />
        );
        return (
          <div key={bar.key} className="flex flex-1 flex-col items-stretch gap-1">
            <div className="flex items-end" style={{ height }}>
              {onBarClick ? (
                <button
                  type="button"
                  aria-label={description}
                  aria-pressed={bar.selected ?? false}
                  onClick={() => onBarClick(bar.key)}
                  className="focus-visible:ring-border-focus flex h-full w-full items-end rounded-t-[3px] outline-none focus-visible:ring-2"
                >
                  {visual}
                </button>
              ) : (
                <div role="img" aria-label={description} className="flex h-full w-full items-end">
                  {visual}
                </div>
              )}
            </div>
            <span aria-hidden="true" className="text-text-muted text-center text-[10px]">
              {bar.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export { FacetHistogram };
export type { FacetHistogramProps, HistogramBar };
