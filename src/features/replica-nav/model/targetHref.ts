import { REPLICA_TABS, replicaHref, type ReplicaTab } from "@/entities/replica";
import type { ReplicaNavItem } from "./types";

const isTab = (segment: string | undefined): segment is ReplicaTab => REPLICA_TABS.some((tab) => tab === segment);

// segments are the route segments below the [replica] layout, e.g. ["analyses", "rmsd"].
const targetHref = (accession: string, target: ReplicaNavItem, segments: readonly string[]): string => {
  const tab = isTab(segments[0]) ? segments[0] : undefined;
  const analysis = tab === "analyses" && segments[1] && target.analyses.includes(segments[1]) ? segments[1] : undefined;
  return replicaHref(accession, target.name, tab, analysis);
};

export { isTab, targetHref };
