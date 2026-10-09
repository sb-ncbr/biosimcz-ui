"use client";

import { useRouter, useSelectedLayoutSegments } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui";
import { targetHref } from "../model/targetHref";
import type { ReplicaNavItem } from "../model/types";

type ReplicaSwitcherProps = { accession: string; replicas: readonly ReplicaNavItem[]; current: string; className?: string };

// Phone replacement for the rail: a long replica list does not fit above the content.
const ReplicaSwitcher = ({ accession, replicas, current, className }: ReplicaSwitcherProps) => {
  const router = useRouter();
  const segments = useSelectedLayoutSegments();

  return (
    <Select
      value={current}
      onValueChange={(name) => {
        const target = replicas.find((item) => item.name === name);
        if (target) router.push(targetHref(accession, target, segments));
      }}
    >
      <SelectTrigger aria-label="Replica" className={className ?? "min-h-11 w-full"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {replicas.map((item) => (
          <SelectItem key={item.name} value={item.name}>
            {item.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export { ReplicaSwitcher };
