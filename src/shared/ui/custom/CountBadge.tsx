import { Badge } from "@e-infra/design-system";
import { cn } from "@/shared/lib";

type CountBadgeProps = {
  count: number;
  // required: solid pill "N required"; optional: quiet "+ N optional"; count: neutral number pill.
  variant?: "required" | "optional" | "count";
  className?: string;
};

const CountBadge = ({ count, variant = "required", className }: CountBadgeProps) => {
  if (variant === "count") {
    return (
      <Badge variant="secondary" className={cn("px-1.5", className)}>
        {count}
      </Badge>
    );
  }
  // Nothing left to fill: the pill disappears instead of showing "0 required".
  if (count <= 0) return null;
  if (variant === "optional") {
    return <span className={cn("text-text-muted text-[11px] whitespace-nowrap", className)}>+ {count} optional</span>;
  }
  return <Badge className={cn("px-2 text-[11px] font-semibold", className)}>{count} required</Badge>;
};

export { CountBadge };
export type { CountBadgeProps };
