"use client";

import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";
import { useId, useState } from "react";
import { ArrowDownAZ, ArrowUpZA } from "lucide-react";
import { Button, Input } from "@/shared/ui";
import { cn } from "@/shared/lib";
import { filterAndSortReplicas, type ReplicaSortOrder } from "../model/sortReplicas";
import { targetHref } from "../model/targetHref";
import type { ReplicaNavItem } from "../model/types";

type ReplicaRailProps = { accession: string; replicas: readonly ReplicaNavItem[]; current: string; className?: string };

const ReplicaRail = ({ accession, replicas, current, className }: ReplicaRailProps) => {
  const segments = useSelectedLayoutSegments();
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState<ReplicaSortOrder>("asc");
  const searchId = useId();
  const shown = filterAndSortReplicas(replicas, query, order);

  return (
    <nav aria-label="Replicas" className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div className="flex items-center gap-2">
        <label htmlFor={searchId} className="sr-only">
          Search replicas
        </label>
        <Input
          id={searchId}
          type="search"
          value={query}
          placeholder="Search replicas"
          className="min-w-0 flex-1"
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={order === "asc" ? "Sorted A to Z, switch to Z to A" : "Sorted Z to A, switch to A to Z"}
          onClick={() => setOrder(order === "asc" ? "desc" : "asc")}
        >
          {order === "asc" ? <ArrowDownAZ aria-hidden /> : <ArrowUpZA aria-hidden />}
        </Button>
      </div>
      {shown.length === 0 ? (
        <p className="text-text-muted text-sm">No replicas match your search.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {shown.map((item) => {
            const active = item.name === current;
            return (
              <li key={item.name}>
                <Link
                  href={targetHref(accession, item, segments)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-visible:ring-border-focus block truncate rounded-md border px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-2",
                    active
                      ? "border-border bg-surface-raised text-text-heading font-medium"
                      : "text-text-muted hover:bg-surface-raised hover:text-text border-transparent",
                  )}
                >
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
};

export { ReplicaRail };
