import type { StructureSource } from "@/entities/deposition";

// E-S1 "structure search by name / AlphaFold id" is PROPOSED and not built on the backend yet, so this answers from a
// small local catalog. The function shape is the contract: swap the body for `bffFetch("/bff/structures/search")`.

type StructureHit = {
  source: Exclude<StructureSource, "custom">;
  id: string;
  title: string;
};

type SearchResult = { ok: true; hits: StructureHit[] } | { ok: false };

const CATALOG: readonly StructureHit[] = [
  { source: "pdb", id: "1AKI", title: "Lysozyme C" },
  { source: "pdb", id: "2LZM", title: "T4 lysozyme" },
  { source: "pdb", id: "1UBQ", title: "Ubiquitin" },
  { source: "pdb", id: "4HHB", title: "Hemoglobin" },
  { source: "pdb", id: "1CRN", title: "Crambin" },
  { source: "alphafold", id: "AF-P00698-F1", title: "Lysozyme C (chicken)" },
  { source: "alphafold", id: "AF-P0DTC2-F1", title: "Spike glycoprotein" },
];

const MIN_QUERY_LENGTH = 2;

const searchStructures = async (query: string, signal?: AbortSignal): Promise<SearchResult> => {
  const q = query.trim().toLowerCase();
  await new Promise<void>((resolve) => setTimeout(resolve, 150));
  if (signal?.aborted) return { ok: true, hits: [] };
  if (q.includes("fail")) return { ok: false };
  return {
    ok: true,
    hits: CATALOG.filter((hit) => hit.id.toLowerCase().includes(q) || hit.title.toLowerCase().includes(q)).slice(0, 8),
  };
};

export { MIN_QUERY_LENGTH, searchStructures };
export type { SearchResult, StructureHit };
