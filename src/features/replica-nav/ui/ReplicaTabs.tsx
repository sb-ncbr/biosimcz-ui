"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { REPLICA_TABS, replicaHref, type ReplicaTab } from "@/entities/replica";
import { cn } from "@/shared/lib";
import { Button } from "@/shared/ui";
import { isTab } from "../model/targetHref";

const LABELS: Record<ReplicaTab, string> = { overview: "Overview", trajectory: "Trajectory viewer", analyses: "Analyses" };

type ReplicaTabsProps = { accession: string; replicaName: string; className?: string };

// The active tab comes from the route segment below the layout, never from the replica name, so a replica called "trajectory_1" stays on its own tab.
// Real links styled as buttons: navigation stays crawlable and keyboard/middle-click friendly.
const ReplicaTabs = ({ accession, replicaName, className }: ReplicaTabsProps) => {
  const segment = useSelectedLayoutSegment();
  const active = isTab(segment ?? undefined) ? segment : null;

  return (
    <nav aria-label="Replica sections" className={cn("flex flex-wrap items-center gap-2", className)}>
      {REPLICA_TABS.map((tab) => (
        <Button
          key={tab}
          asChild
          variant={tab === active ? "default" : "outline"}
          className={cn("focus-visible:ring-border-focus focus-visible:ring-2 max-sm:min-h-11", tab !== active && "border-primary text-primary")}
        >
          <Link href={replicaHref(accession, replicaName, tab)} aria-current={tab === active ? "page" : undefined}>
            {LABELS[tab]}
          </Link>
        </Button>
      ))}
    </nav>
  );
};

export { ReplicaTabs };
