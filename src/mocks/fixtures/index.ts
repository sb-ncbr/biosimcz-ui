import { analysisFixtureNames } from "./mdposit";
import { mdpositProjects } from "./mdpositProjects";

// Sanitized demo data. Copy matches the Figma screens (e.g. "Lysozyme in water").
// The mock IdP signs this person in (no password: the mock sign-in page just has a Continue button).
const TEST_USER = {
  id: "101",
  email: "depositor@example.org",
  givenName: "Jana",
  familyName: "Novakova",
  displayName: "Jana Novakova",
  roles: ["depositor"],
} as const;

const communities = [
  {
    id: "community-1",
    slug: "biosim-cz",
    metadata: { title: "BioSim CZ", description: "Molecular dynamics community" },
    access: { visibility: "public" },
  },
  {
    id: "community-2",
    slug: "membrane-lab",
    metadata: { title: "Membrane Lab", description: "Lipid bilayer simulations" },
    access: { visibility: "public" },
  },
];

// Sanitized MDposit projects: see mdpositProjects.ts.
const projects = mdpositProjects;

const analysisNames = analysisFixtureNames;

const pdbText = "ATOM      1  N   MET A   1      27.340  24.430   2.614  1.00  9.67           N\nEND\n";

// Valid 1x1 PNG, so the thumbnail renders in a browser during offline dev and e2e.
const thumbnailPng = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), (char) => char.charCodeAt(0));

const logoSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8"/></svg>';

const figmaDraftMetadata = {
  study: {
    title: "Lysozyme in water",
    description: "Free text description",
    keywords: ["lysozyme", "solvation"],
    authors: [{ kind: "person", given_name: "Jana", family_name: "Novakova", affiliations: [] }],
    access: "open",
  },
  system: { engine: { name: "GROMACS", version: "2024.1" } },
  runs: [],
};

export { analysisNames, communities, figmaDraftMetadata, logoSvg, pdbText, projects, TEST_USER, thumbnailPng };
