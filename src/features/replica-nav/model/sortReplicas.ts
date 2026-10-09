import type { ReplicaNavItem } from "./types";

type ReplicaSortOrder = "asc" | "desc";

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

const filterAndSortReplicas = (items: readonly ReplicaNavItem[], query: string, order: ReplicaSortOrder): ReplicaNavItem[] => {
  const needle = query.trim().toLowerCase();
  const matching = needle ? items.filter((item) => item.name.toLowerCase().includes(needle)) : [...items];
  return matching.sort((a, b) => (order === "asc" ? 1 : -1) * collator.compare(a.name, b.name));
};

export { filterAndSortReplicas };
export type { ReplicaSortOrder };
