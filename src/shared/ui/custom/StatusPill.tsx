import { Badge } from "@e-infra/design-system";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib";

type DepositionStatus = "draft" | "published" | "embargoed" | "changes_requested";

const LABELS: Record<DepositionStatus, string> = {
  draft: "Draft",
  published: "Published",
  embargoed: "Embargoed",
  changes_requested: "Changes requested",
};

const TONE: Record<DepositionStatus, string> = {
  draft: "bg-base-100 text-base-700",
  published: "bg-success-100 text-success-800",
  embargoed: "bg-warning-100 text-warning-800",
  changes_requested: "bg-warning-100 text-warning-800",
};

type StatusPillProps = {
  status: DepositionStatus;
  children?: ReactNode;
  className?: string;
};

const StatusPill = ({ status, children, className }: StatusPillProps) => (
  <Badge variant="outline" data-status={status} className={cn("border-transparent font-semibold", TONE[status], className)}>
    {children ?? LABELS[status]}
  </Badge>
);

export { StatusPill };
export type { DepositionStatus, StatusPillProps };
