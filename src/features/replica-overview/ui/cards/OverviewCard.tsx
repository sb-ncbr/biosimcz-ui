import type { ReactNode } from "react";
import { cn } from "@/shared/lib";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui";
import type { Row } from "../../lib/rows";

const OverviewCard = ({ title, className, children }: { title: string; className?: string; children: ReactNode }) => (
  <Card className={cn("min-w-0 justify-start", className)}>
    <CardHeader>
      <CardTitle className="text-[15px] font-semibold">{title}</CardTitle>
    </CardHeader>
    <CardContent className="@container flex flex-col gap-4">{children}</CardContent>
  </Card>
);

// A zero stays visible ("0") and a missing value is "N/A", so the grid never shifts between replicas.
const StatTile = ({ label, value }: Row) => (
  <div className="bg-base-100 flex min-w-0 flex-col gap-0.5 rounded-lg px-3 py-2.5">
    <dt className="text-text-muted text-xs">{label}</dt>
    <dd className="text-base font-semibold break-words tabular-nums">{value}</dd>
  </div>
);

const StatGrid = ({ rows, className }: { rows: readonly Row[]; className?: string }) => (
  <dl className={cn("grid gap-2", className)}>
    {rows.map((row) => (
      <StatTile key={row.label} {...row} />
    ))}
  </dl>
);

export { OverviewCard, StatGrid };
