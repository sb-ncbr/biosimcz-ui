import { recordHref } from "@/entities/record/lib/href";
import type { ReplicaTab } from "../model/types";

const experimentsHref = (accession: string): string => `${recordHref(accession)}/experiments`;

// Replica names can contain spaces, "%", "/" or "#", so every segment is encoded.
const replicaHref = (accession: string, replicaName: string, tab?: ReplicaTab, analysis?: string): string => {
  const base = `${experimentsHref(accession)}/${encodeURIComponent(replicaName)}`;
  if (!tab) return base;
  const withTab = `${base}/${tab}`;
  return analysis ? `${withTab}/${encodeURIComponent(analysis)}` : withTab;
};

export { experimentsHref, replicaHref };
