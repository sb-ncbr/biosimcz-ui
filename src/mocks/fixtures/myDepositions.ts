import type { Draft } from "../handlers/state";

// Demo data for "My depositions" (E-L1 mock). Copy follows the Figma screen 102:10726. Metadata uses the PROPOSED wire
// shape (snake_case), the same the mapper reads.

type MockPublished = {
  id: string;
  status: "published";
  title: string;
  updated_at: string;
  created_at: string;
  published_at: string;
  doi: string;
  version: number;
  access: "open" | "embargoed" | "restricted";
  community_ids: string[];
  metadata: Record<string, unknown>;
  // E-R2 file list; an anonymous caller only gets it for open records.
  files?: { key: string; size: number; mimetype: string }[];
};

const authors = {
  novakova: { kind: "person", given_name: "Jana", family_name: "Nováková", affiliations: [] },
  kovar: { kind: "person", given_name: "Petr", family_name: "Kovář", affiliations: [] },
  dvorak: { kind: "person", given_name: "Tomáš", family_name: "Dvořák", affiliations: [] },
  svoboda: { kind: "person", given_name: "Lucie", family_name: "Svoboda", affiliations: [] },
} as const;

const publishedDepositions: MockPublished[] = [
  {
    id: "pub-popc",
    status: "published",
    title: "POPC membrane with cholesterol, 1 µs",
    created_at: "2026-01-20T09:00:00Z",
    updated_at: "2026-02-12T09:00:00Z",
    published_at: "2026-02-12T09:00:00Z",
    doi: "10.1234/mdrepo.4821",
    version: 2,
    access: "open",
    community_ids: ["community-2"],
    metadata: {
      study: {
        title: "POPC membrane with cholesterol, 1 µs",
        description:
          "A 1 µs molecular dynamics simulation of a POPC membrane with cholesterol, intended for studying membrane organization, dynamics, and lipid interactions.",
        keywords: ["membrane", "cholesterol"],
        authors: [authors.novakova, authors.kovar],
        access: "open",
        license: "cc-by-4.0",
        funding: [{ funder_name: "Czech Science Foundation" }],
        community_ids: ["community-2"],
      },
      system: { engine: { name: "GROMACS" } },
    },
    files: [
      { key: "topol.top", size: 20_480, mimetype: "text/plain" },
      { key: "popc-chol.xtc", size: 52_428_800, mimetype: "application/octet-stream" },
    ],
  },
  {
    id: "pub-villin",
    status: "published",
    title: "Villin headpiece replica exchange",
    created_at: "2025-10-01T09:00:00Z",
    updated_at: "2025-11-03T09:00:00Z",
    published_at: "2025-11-03T09:00:00Z",
    doi: "10.1234/mdrepo.4822",
    version: 1,
    access: "embargoed",
    community_ids: ["community-1"],
    metadata: {
      study: {
        title: "Villin headpiece replica exchange",
        description:
          "Replica exchange molecular dynamics simulation of the villin headpiece, providing enhanced sampling data for the analysis of conformational dynamics and folding behavior.",
        keywords: ["replica exchange", "protein dynamics"],
        authors: [authors.novakova, authors.dvorak],
        access: "embargoed",
        embargo: { until: "2027-03-01" },
        license: "cc-by-4.0",
        funding: [{ funder_name: "European Commission" }],
        community_ids: ["community-1"],
      },
      system: { engine: { name: "AMBER" }, starting_structure: { source: "pdb", id: "2F4K", title: "Villin headpiece" } },
    },
    files: [{ key: "villin.prmtop", size: 1_048_576, mimetype: "text/plain" }],
  },
  {
    id: "pub-lysozyme",
    status: "published",
    title: "Hen egg-white lysozyme in water, 100 ns",
    created_at: "2026-03-01T09:00:00Z",
    updated_at: "2026-03-10T09:00:00Z",
    published_at: "2026-03-10T09:00:00Z",
    doi: "10.1234/mdrepo.4823",
    version: 1,
    access: "open",
    community_ids: ["community-1"],
    metadata: {
      study: {
        title: "Hen egg-white lysozyme in water, 100 ns",
        description: "A 100 ns simulation of hen egg-white lysozyme in explicit water, a standard benchmark for protein dynamics.",
        keywords: ["lysozyme", "protein dynamics"],
        authors: [authors.kovar, authors.svoboda],
        access: "open",
        license: "cc0-1.0",
        community_ids: ["community-1"],
      },
      system: { engine: { name: "GROMACS" }, starting_structure: { source: "pdb", id: "1AKI", title: "Lysozyme" } },
    },
    files: [{ key: "lysozyme.tpr", size: 3_145_728, mimetype: "application/octet-stream" }],
  },
  {
    id: "pub-dppc",
    status: "published",
    title: "DPPC bilayer phase transition",
    created_at: "2026-04-01T09:00:00Z",
    updated_at: "2026-04-15T09:00:00Z",
    published_at: "2026-04-15T09:00:00Z",
    doi: "10.1234/mdrepo.4824",
    version: 1,
    access: "restricted",
    community_ids: ["community-2"],
    metadata: {
      study: {
        title: "DPPC bilayer phase transition",
        description: "Temperature scan of a DPPC bilayer across the gel to liquid-crystalline phase transition. Files are available on request.",
        keywords: ["membrane", "phase transition"],
        authors: [authors.dvorak],
        access: "restricted",
        license: "cc-by-nc-4.0",
        community_ids: ["community-2"],
      },
      system: { engine: { name: "AMBER" } },
    },
  },
  {
    id: "pub-ubq",
    status: "published",
    title: "Ubiquitin in 150 mM NaCl",
    created_at: "2026-05-01T09:00:00Z",
    updated_at: "2026-05-20T09:00:00Z",
    published_at: "2026-05-20T09:00:00Z",
    doi: "10.1234/mdrepo.4825",
    version: 1,
    access: "open",
    community_ids: [],
    metadata: {
      study: {
        title: "Ubiquitin in 150 mM NaCl",
        keywords: ["protein dynamics", "ions"],
        authors: [authors.novakova, authors.kovar, authors.dvorak, authors.svoboda],
        access: "open",
        license: "cc-by-4.0",
        community_ids: [],
      },
      system: { engine: { name: "NAMD" }, starting_structure: { source: "pdb", id: "1UBQ", title: "Ubiquitin" } },
    },
    files: [],
  },
];

const hoursAgo = (hours: number): string => new Date(Date.now() - hours * 3_600_000).toISOString();

// Extra drafts for the standalone mock server only (Vitest keeps the two drafts of createMockState).
const demoDrafts = (): Draft[] => [
  {
    id: "draft-ubiquitin",
    status: "draft",
    revision: 1,
    created_at: hoursAgo(24 * 9),
    updated_at: hoursAgo(2),
    files: [],
    metadata: {
      study: {
        title: "Ubiquitin folding at 310 K with replica exchange",
        description: "Replica exchange folding runs of ubiquitin.",
        keywords: ["protein dynamics", "replica exchange"],
        authors: [authors.novakova, authors.kovar],
        access: "open",
        license: "cc-by-4.0",
        community_ids: ["community-1"],
      },
      system: { engine: { name: "GROMACS", version: "2024.1" }, starting_structure: { source: "pdb", id: "1UBQ", title: "Ubiquitin" } },
      runs: [],
    },
  },
  {
    id: "draft-peptide",
    status: "draft",
    revision: 1,
    created_at: hoursAgo(24 * 30),
    updated_at: hoursAgo(24 * 21),
    files: [],
    metadata: {
      study: {
        title: "Custom peptide in DPPC bilayer",
        keywords: ["membrane"],
        authors: [authors.novakova, authors.svoboda],
        access: "open",
        community_ids: [],
      },
      system: { engine: { name: "AMBER" } },
      runs: [],
    },
  },
];

export { demoDrafts, publishedDepositions };
export type { MockPublished };
