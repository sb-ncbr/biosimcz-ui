import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui";
import { cn } from "@/shared/lib";

type ProgressSegment = {
  id: string;
  label: string;
  // 0..1 share of required fields filled in this step.
  value: number;
  // Shown on hover and focus, e.g. "15 of 22 required fields - 64%".
  tooltip?: string;
};

type SegmentedProgressProps = {
  segments: ProgressSegment[];
  "aria-label": string;
  className?: string;
};

const clamp = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

// e-infra Progress is single-valued; the design needs one bar per wizard step.
const SegmentedProgress = ({ segments, className, ...rest }: SegmentedProgressProps) => (
  <div role="group" aria-label={rest["aria-label"]} className={cn("flex gap-[3px]", className)}>
    {segments.map((segment) => {
      const value = clamp(segment.value);
      const percent = Math.round(value * 100);
      return (
        <Tooltip key={segment.id}>
          <TooltipTrigger asChild>
            <div
              role="progressbar"
              tabIndex={0}
              aria-label={segment.label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-valuetext={segment.tooltip ?? `${percent}%`}
              className="bg-base-200 focus-visible:ring-border-focus h-1 flex-1 overflow-hidden rounded-full outline-none focus-visible:ring-2"
            >
              <div className="bg-primary h-full rounded-full transition-[width]" style={{ width: `${percent}%` }} />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">{segment.tooltip ?? `${segment.label}: ${percent}%`}</TooltipContent>
        </Tooltip>
      );
    })}
  </div>
);

export { SegmentedProgress };
export type { ProgressSegment, SegmentedProgressProps };
