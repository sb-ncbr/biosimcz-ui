import { describe, expect, it } from "vitest";
import { filterAndSortReplicas } from "./sortReplicas";

const items = ["replica_10", "replica_2", "Other"].map((name) => ({ name, analyses: [] }));
const names = (list: { name: string }[]) => list.map((item) => item.name);

describe("filterAndSortReplicas", () => {
  it("sorts A-Z with natural numbers and Z-A", () => {
    expect(names(filterAndSortReplicas(items, "", "asc"))).toEqual(["Other", "replica_2", "replica_10"]);
    expect(names(filterAndSortReplicas(items, "", "desc"))).toEqual(["replica_10", "replica_2", "Other"]);
  });

  it("filters by trimmed, case-insensitive text", () => {
    expect(names(filterAndSortReplicas(items, "  REPLICA ", "asc"))).toEqual(["replica_2", "replica_10"]);
    expect(filterAndSortReplicas(items, "zzz", "asc")).toEqual([]);
  });

  it("does not mutate the input", () => {
    const copy = [...items];
    filterAndSortReplicas(items, "", "desc");
    expect(items).toEqual(copy);
  });
});
